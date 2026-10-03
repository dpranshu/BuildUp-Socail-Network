import 'dart:async';

import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'chat_screen.dart';
import 'collabs_screen.dart';
import 'post_detail_screen.dart';
import 'profile_screen.dart';

typedef DbRow = Map<String, dynamic>;

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.repository});
  final AppRepository repository;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<SocialNotificationPage> _future = widget.repository
      .loadNotificationPage();
  final List<DbRow> _additionalNotifications = [];
  String? _cursorCreatedAt;
  String? _cursorId;
  bool _hasMore = false;
  bool _loadingMore = false;
  Timer? _refreshTimer;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => _refresh(),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    late final Future<SocialNotificationPage> future;
    setState(() {
      _additionalNotifications.clear();
      _cursorCreatedAt = null;
      _cursorId = null;
      _hasMore = false;
      _loadingMore = false;
      _error = null;
      future = widget.repository.loadNotificationPage();
      _future = future;
    });
    try {
      final page = await future;
      if (!mounted || future != _future) return;
      setState(() {
        _cursorCreatedAt = page.cursorCreatedAt;
        _cursorId = page.cursorId;
        _hasMore = page.hasMore;
      });
    } catch (_) {
      // The FutureBuilder displays the notification error state.
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore ||
        _loadingMore ||
        _cursorCreatedAt == null ||
        _cursorId == null) {
      return;
    }
    final future = _future;
    final createdAt = _cursorCreatedAt!;
    final id = _cursorId!;
    setState(() {
      _loadingMore = true;
      _error = null;
    });
    try {
      final page = await widget.repository.loadNotificationPage(
        beforeCreatedAt: createdAt,
        beforeId: id,
      );
      if (!mounted || future != _future) return;
      setState(() {
        _additionalNotifications.addAll(page.notifications);
        _cursorCreatedAt = page.cursorCreatedAt;
        _cursorId = page.cursorId;
        _hasMore = page.hasMore;
      });
    } catch (_) {
      if (mounted && future == _future) {
        setState(() => _error = 'Could not load older activity.');
      }
    } finally {
      if (mounted && future == _future) {
        setState(() => _loadingMore = false);
      }
    }
  }

  Future<void> _markAll(List<DbRow> rows) async {
    try {
      await widget.repository.markAllNotificationsRead();
      if (!mounted) return;
      setState(() {
        for (final row in rows) {
          row['read_at'] ??= DateTime.now().toUtc().toIso8601String();
        }
        _error = null;
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not mark notifications as read.');
      }
    }
  }

  Future<void> _markAllFromCurrentList() async {
    try {
      final page = await _future;
      await _markAll([
        ...page.notifications,
        ..._additionalNotifications,
      ]);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Could not load notifications to mark as read.',
        );
      }
    }
  }

  Future<void> _open(DbRow row) async {
    try {
      if (row['read_at'] == null) {
        await widget.repository.markNotificationRead(stringValue(row['id']));
      }
      if (!mounted) return;
      setState(
        () => row['read_at'] ??= DateTime.now().toUtc().toIso8601String(),
      );
      final actor = rowValue(row['actor']);
      final actorId = stringValue(row['actor_id']);
      final type = stringValue(row['notification_type']);
      if (row['conversation_id'] != null) {
        final participant = Creator.fromRow({'id': actorId, ...actor});
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ChatScreen(
              repository: widget.repository,
              conversationId: stringValue(row['conversation_id']),
              participant: participant,
            ),
          ),
        );
      } else if (type == 'collab_interest') {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => CollabsScreen(
              repository: widget.repository,
              initialTab: 1,
              postOpportunity: () {},
              openProfile: (id) => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ProfileScreen(
                    repository: widget.repository,
                    userId: id,
                    isSelf: id == widget.repository.userId,
                  ),
                ),
              ),
            ),
          ),
        );
      } else if (type == 'collab_accepted' && actorId.isNotEmpty) {
        final conversationId = await widget.repository.startConversation(
          actorId,
        );
        if (!mounted) return;
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ChatScreen(
              repository: widget.repository,
              conversationId: conversationId,
              participant: Creator.fromRow({'id': actorId, ...actor}),
            ),
          ),
        );
      } else if (type == 'collab_declined') {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => CollabsScreen(
              repository: widget.repository,
              postOpportunity: () {},
              openProfile: (id) => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ProfileScreen(
                    repository: widget.repository,
                    userId: id,
                    isSelf: id == widget.repository.userId,
                  ),
                ),
              ),
            ),
          ),
        );
      } else if (stringValue(row['post_id']).isNotEmpty) {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => PostDetailScreen(
              repository: widget.repository,
              postId: stringValue(row['post_id']),
            ),
          ),
        );
      } else if (actorId.isNotEmpty) {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ProfileScreen(
              repository: widget.repository,
              userId: actorId,
              isSelf: actorId == widget.repository.userId,
            ),
          ),
        );
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not open this notification.');
    }
  }

  String _message(String type, String actor, DbRow row) {
    final postText = stringValue(rowValue(row['post'])['body']);
    final contextText = postText.isEmpty
        ? ''
        : ' on “${postText.length > 50 ? '${postText.substring(0, 50)}…' : postText}”';
    return switch (type) {
      'like' || 'post_like' => '$actor liked your post$contextText.',
      'comment' ||
      'post_comment' => '$actor commented on your post$contextText.',
      'follow' || 'new_follower' => '$actor started following you.',
      'collab_interest' ||
      'interest' => '$actor is interested in collaborating$contextText.',
      'collab_accepted' => '$actor accepted your collaboration introduction.',
      'collab_declined' =>
        '$actor responded to your collaboration introduction.',
      'collab_response' => '$actor responded to your collaboration interest.',
      'message' || 'new_message' => '$actor sent you a message.',
      'repost' => '$actor reposted your post$contextText.',
      _ => '$actor has an update for you.',
    };
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Notifications'),
      actions: [
        IconButton(
          tooltip: 'Mark all read',
          onPressed: _markAllFromCurrentList,
          icon: const Icon(Icons.done_all_rounded),
        ),
      ],
    ),
    body: PageFrame(
    child: FutureBuilder<SocialNotificationPage>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              !snapshot.hasData) {
            return const LoadingPanel(label: 'Loading notifications…');
          }
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Notifications could not be loaded.'),
                  TextButton(
                    onPressed: _refresh,
                    child: const Text('Try again'),
                  ),
                ],
              ),
            );
          }
          final page = snapshot.data;
          if (page == null) {
            return const Center(child: Text('Notifications are unavailable.'));
          }
          if (_cursorCreatedAt == null && page.hasMore) {
            _cursorCreatedAt = page.cursorCreatedAt;
            _cursorId = page.cursorId;
            _hasMore = page.hasMore;
          }
          final rows = [...page.notifications, ..._additionalNotifications];
          return Column(
            children: [
              if (_error != null) InlineNotice(text: _error!, isError: true),
              Expanded(
                child: rows.isEmpty
                    ? const Center(child: Text('You are all caught up.'))
                    : RefreshIndicator(
                        onRefresh: _refresh,
                        child: ListView.separated(
                          itemCount: rows.length,
                          separatorBuilder: (_, _) =>
                              const Divider(height: 1, indent: 74),
                          itemBuilder: (context, index) {
                            final row = rows[index];
                            final actor = rowValue(row['actor']);
                            final name = stringValue(
                              actor['display_name'],
                              'Someone',
                            );
                            final isUnread = row['read_at'] == null;
                            final message = _message(
                              stringValue(row['notification_type']),
                              name,
                              row,
                            );
                            return ListTile(
                              onTap: () => _open(row),
                              leading: Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  CreatorAvatar(
                                    url: actor['avatar_url'] as String?,
                                    name: name,
                                    radius: 22,
                                  ),
                                  Positioned(
                                    right: -3,
                                    bottom: -3,
                                    child: Container(
                                      width: 20,
                                      height: 20,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF329CFF),
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: const Color(0xFF141312),
                                          width: 2,
                                        ),
                                      ),
                                      child: Icon(
                                        _notificationIcon(
                                          stringValue(row['notification_type']),
                                        ),
                                        size: 10,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              title: Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(
                                      text: name,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    TextSpan(text: message.substring(name.length)),
                                  ],
                                ),
                                style: TextStyle(
                                  fontWeight: isUnread
                                      ? FontWeight.w700
                                      : FontWeight.normal,
                                ),
                              ),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  relativeTime(stringValue(row['created_at'])),
                                  style: const TextStyle(color: Colors.white54),
                                ),
                              ),
                              trailing: isUnread
                                  ? const CircleAvatar(
                                      radius: 4,
                                      backgroundColor: Color(0xFFF43F5E),
                                    )
                                  : null,
                            );
                          },
                        ),
                      ),
              ),
              if (_hasMore || _loadingMore)
                Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: _loadingMore
                          ? const Center(child: CircularProgressIndicator())
                          : TextButton(
                              onPressed: _loadMore,
                              child: const Text('Load older activity'),
                            ),
                ),
            ],
          );
        },
      ),
    ),
  );

  IconData _notificationIcon(String type) => switch (type) {
    'like' => Icons.favorite,
    'follow' => Icons.person_add_alt_1,
    'comment' => Icons.chat_bubble_outline,
    'repost' => Icons.repeat,
    'collab_interest' ||
    'collab_accepted' ||
    'collab_declined' => Icons.handshake_outlined,
    'message' => Icons.chat_bubble_outline,
    _ => Icons.notifications_none,
  };
}
