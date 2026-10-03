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
  late Future<List<SocialPost>> _future;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _future = widget.repository.loadFeed();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _refresh(),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  void _refresh() {
    setState(() => _future = widget.repository.loadFeed(mode: _mode));
  }

  void _setMode(String mode) {
    setState(() {
      _mode = mode;
      _future = widget.repository.loadFeed(mode: mode);
    });
  }

  Widget _tab(String value, String label) => Expanded(
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
  );

  @override
  Widget build(BuildContext context) => PageFrame(
    child: Column(
      children: [
        Container(
          height: 49,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(color: Colors.white.withValues(alpha: 0.09)),
            ),
          ),
          child: Row(
            children: [
              _tab('for-you', 'For You'),
              _tab('following', 'Following'),
              _tab('latest', 'Latest'),
            ],
          ),
        ),
        Expanded(
          child: FutureBuilder<List<SocialPost>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting &&
                  !snapshot.hasData) {
                return const LoadingPanel(label: 'Loading your feed…');
              }
              if (snapshot.hasError) {
                return Center(
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
                );
              }
              final posts = snapshot.data ?? <SocialPost>[];
              if (posts.isEmpty) {
                return RefreshIndicator(
                  onRefresh: () async => _refresh(),
                  child: ListView(
                    children: const [
                      SizedBox(height: 140),
                      Icon(
                        Icons.dynamic_feed_outlined,
                        size: 44,
                        color: Colors.white38,
                      ),
                      SizedBox(height: 14),
                      Center(
                        child: Text(
                          'Nothing here yet. Follow creators or share your first post.',
                        ),
                      ),
                    ],
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: () async => _refresh(),
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 18),
                  itemCount: posts.length,
                  itemBuilder: (context, index) => PostCard(
                    key: ValueKey(posts[index].id),
                    post: posts[index],
                    repository: widget.repository,
                    openProfile: widget.openProfile,
                    onDeleted: _refresh,
                  ),
                ),
              );
            },
          ),
        ),
      ],
    ),
  );
}
