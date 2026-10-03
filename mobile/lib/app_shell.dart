import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'data/repository.dart';
import 'screens/collabs_screen.dart';
import 'screens/create_screen.dart';
import 'screens/feed_screen.dart';
import 'screens/messages_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/search_screen.dart';
import 'widgets.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _selected = 0;
  int _refreshKey = 0;
  bool _createOpportunity = false;
  late final AppRepository _repository = AppRepository(
    Supabase.instance.client,
  );
  Timer? _unreadTimer;
  int _unreadNotifications = 0;
  int _unreadConversations = 0;
  String? _unreadError;

  @override
  void initState() {
    super.initState();
    _refreshUnread();
    _unreadTimer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => _refreshUnread(),
    );
  }

  @override
  void dispose() {
    _unreadTimer?.cancel();
    super.dispose();
  }

  Future<void> _refreshUnread() async {
    try {
      final counts = await _repository.loadUnreadCounts();
      if (mounted) {
        setState(() {
          _unreadNotifications = counts.$1;
          _unreadConversations = counts.$2;
          _unreadError = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _unreadError = 'Unread badges could not be refreshed.');
      }
    }
  }

  void _select(int index, {bool createOpportunity = false}) {
    setState(() {
      _selected = index;
      _createOpportunity = index == 2 && createOpportunity;
      _refreshKey++;
    });
  }

  void _openProfile() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProfileScreen(
          repository: _repository,
          userId: _repository.userId,
          isSelf: true,
        ),
      ),
    );
  }

  void _openSearch() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SearchScreen(repository: _repository),
      ),
    );
  }

  void _openNotifications() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => NotificationsScreen(repository: _repository),
      ),
    );
  }

  Widget _destination() => switch (_selected) {
    0 => FeedScreen(
      key: ValueKey('feed-$_refreshKey'),
      repository: _repository,
      openProfile: (id) {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ProfileScreen(
              repository: _repository,
              userId: id,
              isSelf: id == _repository.userId,
            ),
          ),
        );
      },
    ),
    1 => CollabsScreen(
      key: ValueKey('collabs-$_refreshKey'),
      repository: _repository,
      postOpportunity: () => _select(2, createOpportunity: true),
      openProfile: (id) {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ProfileScreen(
              repository: _repository,
              userId: id,
              isSelf: id == _repository.userId,
            ),
          ),
        );
      },
    ),
    2 => CreateScreen(
      key: ValueKey('create-$_refreshKey'),
      repository: _repository,
      initialKind: _createOpportunity ? 'opportunity' : 'post',
      onPosted: () => _select(0),
    ),
    _ => MessagesScreen(
      key: ValueKey('messages-$_refreshKey'),
      repository: _repository,
    ),
  };

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isTablet = screenWidth >= 640;
    final metadata = Supabase.instance.client.auth.currentUser?.userMetadata;
    final avatarUrl = metadata?['avatar_url'];
    final displayName = metadata?['display_name'];
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final headerMaxWidth = isTablet ? 598.0 : 420.0;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            SizedBox(
              height: 72,
              child: Center(
                child: SizedBox(
                  width: headerMaxWidth,
                  child: Container(
                    height: 72,
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: Colors.white.withValues(alpha: 0.07),
                        ),
                      ),
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        const Text(
                          'Buildup',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                          ),
                        ),
                        Positioned(
                          left: 16,
                          child: IconButton(
                            tooltip: 'Your profile',
                            onPressed: _openProfile,
                            icon: avatarUrl is String && avatarUrl.isNotEmpty
                                ? CreatorAvatar(
                                    url: avatarUrl,
                                    name: displayName is String
                                        ? displayName
                                        : '',
                                    radius: 16,
                                  )
                                : const CircleAvatar(
                                    radius: 16,
                                    backgroundColor: Color(0xFF242220),
                                    child: Icon(
                                      Icons.person_outline_rounded,
                                      size: 20,
                                      color: Color(0xFFC5BFB7),
                                    ),
                                  ),
                          ),
                        ),
                        Positioned(
                          right: 8,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                tooltip: 'Search',
                                onPressed: _openSearch,
                                icon: const Icon(
                                  Icons.search_rounded,
                                  size: 24,
                                ),
                              ),
                              IconButton(
                                tooltip: _unreadError ?? 'Notifications',
                                onPressed: _openNotifications,
                                icon: Badge(
                                  isLabelVisible: _unreadNotifications > 0,
                                  label: Text(
                                    _unreadNotifications > 9
                                        ? '9+'
                                        : '$_unreadNotifications',
                                  ),
                                  child: const Icon(
                                    Icons.notifications_none_rounded,
                                    size: 24,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            if (_unreadError != null)
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 598),
                child: MaterialBanner(
                  content: Text(_unreadError!),
                  actions: [
                    TextButton(
                      onPressed: _refreshUnread,
                      child: const Text('Retry'),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _unreadError = null),
                      child: const Text('Dismiss'),
                    ),
                  ],
                ),
              ),
            Expanded(child: _destination()),
          ],
        ),
      ),
      floatingActionButton: _selected == 3
          ? FloatingActionButton(
              tooltip: 'New message',
              onPressed: _openSearch,
              child: const Icon(Icons.edit_outlined),
            )
          : null,
      bottomNavigationBar: isTablet
          ? Padding(
              padding: EdgeInsets.only(bottom: bottomInset + 18),
              child: Center(
                heightFactor: 1,
                child: SizedBox(
                  width: screenWidth * 0.78 > 420 ? 420 : screenWidth * 0.78,
                  height: 64,
                  child: _buildNavigation(showLabels: false, floating: true),
                ),
              ),
            )
          : _buildNavigation(showLabels: true, floating: false),
    );
  }

  Widget _buildNavigation({required bool showLabels, required bool floating}) {
    const items = [
      (label: 'Home', icon: Icons.home_outlined),
      (label: 'Collabs', icon: Icons.handshake_outlined),
      (label: 'Create', icon: Icons.add_rounded),
      (label: 'Messages', icon: Icons.chat_bubble_outline_rounded),
    ];
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Container(
      height: showLabels ? 68 + bottomInset : 64,
      padding: EdgeInsets.only(bottom: showLabels ? bottomInset : 0),
      decoration: BoxDecoration(
        color: const Color(0xFF0D0F11),
        border: floating
            ? null
            : Border(
                top: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
              ),
        borderRadius: floating ? BorderRadius.circular(18) : null,
        boxShadow: floating
            ? const [BoxShadow(color: Color(0x2E000000), blurRadius: 24)]
            : null,
      ),
      child: Row(
        children: [
          for (var index = 0; index < items.length; index++)
            Expanded(
              child: _NavigationItem(
                label: items[index].label,
                icon: items[index].icon,
                selected: _selected == index,
                showLabel: showLabels,
                badge: index == 3 ? _unreadConversations : 0,
                onTap: () => _select(index),
              ),
            ),
        ],
      ),
    );
  }
}

class _NavigationItem extends StatelessWidget {
  const _NavigationItem({
    required this.label,
    required this.icon,
    required this.selected,
    required this.showLabel,
    required this.badge,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final bool showLabel;
  final int badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: label,
    child: InkWell(
      onTap: onTap,
      child: SizedBox(
        height: showLabel ? 68 : 64,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Badge(
              isLabelVisible: badge > 0,
              label: Text(badge > 9 ? '9+' : '$badge'),
              child: Container(
                width: 48,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFF163247)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  icon,
                  size: 24,
                  color: selected ? Colors.white : const Color(0xFFC5BFB7),
                ),
              ),
            ),
            if (showLabel) ...[
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : const Color(0xFFC5BFB7),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  height: 1.2,
                ),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}
