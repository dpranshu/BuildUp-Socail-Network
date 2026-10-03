import 'dart:async';

import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'post_card.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({
    super.key,
    required this.repository,
    required this.openProfile,
  });
  final AppRepository repository;
  final ValueChanged<String> openProfile;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  String _mode = 'for-you';
  late Future<SocialPostPage> _future;
  final ScrollController _scrollController = ScrollController();
  final List<SocialPost> _additionalPosts = [];
  String? _cursorCreatedAt;
  String? _cursorId;
  String? _loadMoreError;
  int _requestId = 0;
  bool _hasMore = false;
  bool _loadingMore = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_checkLoadMore);
    _future = _loadFirstPage(_mode, ++_requestId);
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _refresh(),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _scrollController
      ..removeListener(_checkLoadMore)
      ..dispose();
    super.dispose();
  }

  Future<SocialPostPage> _loadFirstPage(String mode, int requestId) async {
    final page = await widget.repository.loadFeedPage(mode: mode);
    if (mounted && requestId == _requestId) {
      setState(() {
        _additionalPosts.clear();
        _cursorCreatedAt = page.cursorCreatedAt;
        _cursorId = page.cursorId;
        _hasMore = page.hasMore;
        _loadingMore = false;
        _loadMoreError = null;
      });
    }
    return page;
  }

  Future<void> _refresh() async {
    late final Future<SocialPostPage> future;
    setState(() {
      final requestId = ++_requestId;
      _additionalPosts.clear();
      _cursorCreatedAt = null;
      _cursorId = null;
      _hasMore = false;
      _loadingMore = false;
      _loadMoreError = null;
      future = _loadFirstPage(_mode, requestId);
      _future = future;
    });
    try {
      await future;
    } catch (_) {
      // The FutureBuilder displays the feed error state.
    }
  }

  void _setMode(String mode) {
    if (_mode == mode) return;
    setState(() {
      _mode = mode;
      final requestId = ++_requestId;
      _additionalPosts.clear();
      _cursorCreatedAt = null;
      _cursorId = null;
      _hasMore = false;
      _loadingMore = false;
      _loadMoreError = null;
      _future = _loadFirstPage(mode, requestId);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) _scrollController.jumpTo(0);
    });
  }

  void _checkLoadMore() {
    if (_scrollController.hasClients &&
        _scrollController.position.extentAfter < 600) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore ||
        _loadingMore ||
        _cursorCreatedAt == null ||
        _cursorId == null) {
      return;
    }
    final requestId = _requestId;
    final createdAt = _cursorCreatedAt!;
    final id = _cursorId!;
    setState(() {
      _loadingMore = true;
      _loadMoreError = null;
    });
    try {
      final page = await widget.repository.loadFeedPage(
        mode: _mode,
        beforeCreatedAt: createdAt,
        beforeId: id,
      );
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _additionalPosts.addAll(page.posts);
        _cursorCreatedAt = page.cursorCreatedAt;
        _cursorId = page.cursorId;
        _hasMore = page.hasMore;
      });
    } catch (_) {
      if (mounted && requestId == _requestId) {
        setState(() => _loadMoreError = 'Could not load more posts.');
      }
    } finally {
      if (mounted && requestId == _requestId) {
        setState(() => _loadingMore = false);
      }
    }
  }

  Widget _feedTabs() => Container(
    height: 49,
    padding: const EdgeInsets.symmetric(horizontal: 20),
    decoration: BoxDecoration(
      border: Border(
        bottom: BorderSide(color: Colors.white.withValues(alpha: 0.09)),
      ),
    ),
    child: Row(
      children: [
        for (final (value, label) in [
          ('for-you', 'For You'),
          ('following', 'Following'),
          ('latest', 'Latest'),
        ])
          Expanded(
            child: InkWell(
              onTap: () => _setMode(value),
              child: SizedBox(
                height: 48,
                child: Column(
                  children: [
                    Expanded(
                      child: Center(
                        child: Text(
                          label,
                          style: TextStyle(
                            color: _mode == value
                                ? const Color(0xFFF5F2EE)
                                : const Color(0xFFAAA49D),
                            fontSize: 14,
                            fontWeight: _mode == value
                                ? FontWeight.w600
                                : FontWeight.w400,
                          ),
                        ),
                      ),
                    ),
                    Container(
                      height: 2,
                      color: _mode == value
                          ? const Color(0xFFF5F2EE)
                          : Colors.transparent,
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) => PageFrame(
    child: FutureBuilder<SocialPostPage>(
      future: _future,
      builder: (context, snapshot) {
        final loading =
            snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData;
        final failed = snapshot.hasError;
        final posts = [...?snapshot.data?.posts, ..._additionalPosts];
        final showFooter =
            !loading &&
            !failed &&
            posts.isNotEmpty &&
            (_hasMore || _loadingMore || _loadMoreError != null);
        final contentCount = loading || failed || posts.isEmpty
            ? 1
            : posts.length + (showFooter ? 1 : 0);

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.builder(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 18),
            itemCount: contentCount + 1,
            itemBuilder: (context, index) {
              if (index == 0) return _feedTabs();
              final contentIndex = index - 1;
              if (loading) {
                return const SizedBox(
                  height: 260,
                  child: LoadingPanel(label: 'Loading your feed…'),
                );
              }
              if (failed) {
                return SizedBox(
                  height: 260,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Unable to load the feed.'),
                        const SizedBox(height: 10),
                        OutlinedButton.icon(
                          onPressed: _refresh,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Try again'),
                        ),
                      ],
                    ),
                  ),
                );
              }
              if (posts.isEmpty) {
                return const SizedBox(
                  height: 300,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.dynamic_feed_outlined,
                        size: 44,
                        color: Colors.white38,
                      ),
                      SizedBox(height: 14),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          'Nothing here yet. Follow creators or share your first post.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                );
              }
              if (contentIndex == posts.length) {
                return Padding(
                  padding: const EdgeInsets.all(18),
                  child: Center(
                    child: _loadingMore
                        ? const CircularProgressIndicator()
                        : TextButton(
                            onPressed: _loadMore,
                            child: Text(_loadMoreError ?? 'Load more posts'),
                          ),
                  ),
                );
              }
              final post = posts[contentIndex];
              return PostCard(
                key: ValueKey(post.id),
                post: post,
                repository: widget.repository,
                openProfile: widget.openProfile,
                onDeleted: _refresh,
              );
            },
          ),
        );
      },
    ),
  );
}
