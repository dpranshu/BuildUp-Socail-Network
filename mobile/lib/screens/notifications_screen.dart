import 'dart:async';

import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'chat_screen.dart';
import 'profile_screen.dart';

typedef DbRow = Map<String, dynamic>;

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.repository});
  final AppRepository repository;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late Future<List<DbRow>> _future = widget.repository.loadNotifications();
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

  void _refresh() =>
      setState(() => _future = widget.repository.loadNotifications());

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
      await _markAll(await _future);
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
      child: FutureBuilder<List<DbRow>>(
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
          final rows = snapshot.data ?? [];
          return Column(
            children: [
              if (_error != null) InlineNotice(text: _error!, isError: true),
              Expanded(
                child: rows.isEmpty
                    ? const Center(child: Text('You are all caught up.'))
                    : RefreshIndicator(
                        onRefresh: () async => _refresh(),
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
                            return ListTile(
                              onTap: () => _open(row),
                              leading: Stack(
                                children: [
                                  CreatorAvatar(
                                    url: actor['avatar_url'] as String?,
                                    name: name,
                                    radius: 22,
                                  ),
                                  if (isUnread)
                                    const Positioned(
                                      right: 0,
                                      top: 0,
                                      child: CircleAvatar(
                                        radius: 5,
                                        backgroundColor: Color(0xFF329CFF),
                                      ),
                                    ),
                                ],
                              ),
                              title: Text(
                                _message(
                                  stringValue(row['notification_type']),
                                  name,
                                  row,
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
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    ),
  );
}
