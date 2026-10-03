import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'data/repository.dart';
import 'models.dart';
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
  String? _headerAvatarUrl;
  String _headerDisplayName = '';
  double _previousScrollOffset = 0;
  bool _chromeHidden = false;

  @override
  void initState() {
    super.initState();
    AppNavigation.activeTab = _selected;
    AppNavigation.tabRequest.addListener(_handleTabRequest);
    _refreshUnread();
    unawaited(_refreshHeaderProfile());
    _unreadTimer = Timer.periodic(
      const Duration(seconds: 20),
      (_) => _refreshUnread(),
    );
  }

  @override
  void dispose() {
    _unreadTimer?.cancel();
    AppNavigation.tabRequest.removeListener(_handleTabRequest);
    super.dispose();
  }

  void _handleTabRequest() {
    final requestedTab = AppNavigation.tabRequest.value;
    if (requestedTab == null) return;
    AppNavigation.tabRequest.value = null;
    Navigator.of(context).popUntil((route) => route.isFirst);
    _select(requestedTab);
  }

  Future<void> _refreshUnread() async {
    try {
      final counts = await _repository.loadUnreadCounts();
      if (mounted) {
        setState(() {
          _unreadNotifications = counts.$1;
          _unreadConversations = counts.$2;
          AppNavigation.unreadMessages = counts.$2;
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
      AppNavigation.activeTab = index;
      _createOpportunity = index == 2 && createOpportunity;
      _refreshKey++;
      _previousScrollOffset = 0;
      _chromeHidden = false;
    });
  }

  bool _handleScroll(ScrollNotification notification) {
    if (notification is! ScrollUpdateNotification || notification.depth != 0) {
      return false;
    }
    final currentOffset = notification.metrics.pixels
        .clamp(0.0, double.infinity)
        .toDouble();
    final scrollDelta = currentOffset - _previousScrollOffset;
    if (currentOffset < 72) {
      if (_chromeHidden) setState(() => _chromeHidden = false);
    } else if (scrollDelta > 4) {
      if (!_chromeHidden) setState(() => _chromeHidden = true);
    } else if (scrollDelta < -4) {
      if (_chromeHidden) setState(() => _chromeHidden = false);
    }
    _previousScrollOffset = currentOffset;
    return false;
  }

  Future<void> _refreshHeaderProfile() async {
    try {
      final creator = await _repository.loadProfile();
      _setHeaderProfile(creator);
    } catch (error) {
      debugPrint('Could not load the current profile avatar: $error');
    }
  }

  void _setHeaderProfile(Creator creator) {
    if (!mounted) return;
    setState(() {
      _headerAvatarUrl = creator.avatarUrl;
      _headerDisplayName = creator.name;
    });
  }

  Future<void> _openProfile() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProfileScreen(
          repository: _repository,
          userId: _repository.userId,
          isSelf: true,
          onSelfProfileLoaded: _setHeaderProfile,
        ),
      ),
    );
    await _refreshHeaderProfile();
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
              onSelfProfileLoaded: id == _repository.userId
                  ? _setHeaderProfile
                  : null,
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
              onSelfProfileLoaded: id == _repository.userId
                  ? _setHeaderProfile
                  : null,
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
    final headerMaxWidth = isTablet ? 598.0 : 420.0;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Row(
          children: [
            if (isTablet) _buildTabletNavigation(),
            Expanded(
              child: Column(
                children: [
                  AnimatedSize(
                    alignment: Alignment.topCenter,
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeInOut,
                    child: _chromeHidden
                        ? const SizedBox.shrink()
                        : SizedBox(
                            height: 72,
                            child: Center(
                              child: SizedBox(
                                width: headerMaxWidth,
                                child: Container(
                                  height: 72,
                                  decoration: BoxDecoration(
                                    border: Border(
                                      bottom: BorderSide(
                                        color: Colors.white.withValues(
                                          alpha: 0.07,
                                        ),
                                      ),
                                    ),
                                  ),
                                  child: Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      const SizedBox(
                                        width: 96,
                                        height: 28,
                                        child: Center(
                                          child: Text(
                                            'Buildup',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontFamily: 'Syne',
                                              fontSize: 20.6,
                                              fontWeight: FontWeight.w700,
                                              letterSpacing: 0,
                                            ),
                                          ),
                                        ),
                                      ),
                                      Positioned(
                                        left: 16,
                                        child: IconButton(
                                          tooltip: 'Your profile',
                                          onPressed: _openProfile,
                                          icon: CreatorAvatar(
                                            url: _headerAvatarUrl,
                                            name: _headerDisplayName,
                                            radius: 16,
                                          ),
                                        ),
                                      ),
                                      Positioned(
                                        right: isTablet ? 20 : 12,
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            _HeaderIconButton(
                                              tooltip: 'Search',
                                              onPressed: _openSearch,
                                              icon: const LucideIcon(
                                                LucideIconType.search,
                                                size: 24,
                                                strokeWidth: 1.8,
                                              ),
                                            ),
                                            SizedBox(width: isTablet ? 8 : 4),
                                            _HeaderIconButton(
                                              tooltip:
                                                  _unreadError ??
                                                  'Notifications',
                                              onPressed: _openNotifications,
                                              icon: Badge(
                                                isLabelVisible:
                                                    _unreadNotifications > 0,
                                                label: Text(
                                                  _unreadNotifications > 9
                                                      ? '9+'
                                                      : '$_unreadNotifications',
                                                ),
                                                child: const LucideIcon(
                                                  LucideIconType.bell,
                                                  size: 24,
                                                  strokeWidth: 1.8,
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
                            onPressed: () =>
                                setState(() => _unreadError = null),
                            child: const Text('Dismiss'),
                          ),
                        ],
                      ),
                    ),
                  Expanded(
                    child: NotificationListener<ScrollNotification>(
                      onNotification: _handleScroll,
                      child: _destination(),
                    ),
                  ),
                ],
              ),
            ),
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
          ? null
          : AnimatedSize(
              alignment: Alignment.bottomCenter,
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeInOut,
              child: _chromeHidden
                  ? const SizedBox.shrink()
                  : AppBottomNavigationBar(
                      selectedIndex: _selected,
                      unreadMessages: _unreadConversations,
                      onTap: _select,
                    ),
            ),
    );
  }

  Widget _buildTabletNavigation() => AppNavigationRail(
    selectedIndex: _selected,
    unreadMessages: _unreadConversations,
    onTap: _select,
  );
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.tooltip,
    required this.onPressed,
    required this.icon,
  });

  final String tooltip;
  final VoidCallback onPressed;
  final Widget icon;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 40,
    height: 40,
    child: IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints.tightFor(width: 40, height: 40),
      style: IconButton.styleFrom(
        foregroundColor: const Color(0xFFAAA49D),
        shape: const CircleBorder(),
      ),
      icon: icon,
    ),
  );
}
