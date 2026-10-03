import 'dart:async';

import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'post_card.dart';
import 'profile_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, required this.repository});
  final AppRepository repository;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen>
    with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  late final TabController _tabs = TabController(length: 2, vsync: this);
  Timer? _debounce;
  List<Creator> _creators = [];
  List<SocialPost> _posts = [];
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _tabs.dispose();
    super.dispose();
  }

  void _onQuery(String value) {
    _debounce?.cancel();
    if (value.trim().length < 2) {
      setState(() {
        _creators = [];
        _posts = [];
        _loading = false;
        _error = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(value));
  }

  Future<void> _search(String query) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        widget.repository.searchCreators(query),
        widget.repository.searchPostsAndOpportunities(query),
      ]);
      if (mounted) {
        setState(() {
          _creators = results[0] as List<Creator>;
          _posts = results[1] as List<SocialPost>;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Search is unavailable right now.';
        });
      }
    }
  }

  void _openProfile(String id) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProfileScreen(
          repository: widget.repository,
          userId: id,
          isSelf: id == widget.repository.userId,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
          child: TextField(
            controller: _controller,
            autofocus: true,
            onChanged: _onQuery,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search_rounded),
              hintText: 'Creators, posts, and opportunities',
              suffixIcon: IconButton(
                onPressed: () {
                  _controller.clear();
                  _onQuery('');
                },
                icon: const Icon(Icons.close),
              ),
            ),
          ),
        ),
        TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'People'),
            Tab(text: 'Posts'),
          ],
        ),
        if (_error != null) InlineNotice(text: _error!, isError: true),
        Expanded(
          child: _loading
              ? const LoadingPanel(label: 'Searching…')
              : TabBarView(
                  controller: _tabs,
                  children: [
                    _creators.isEmpty
                        ? const Center(
                            child: Text(
                              'Search for creators by name or handle.',
                            ),
                          )
                        : ListView.builder(
                            itemCount: _creators.length,
                            itemBuilder: (context, index) {
                              final creator = _creators[index];
                              return ListTile(
                                leading: CreatorAvatar(
                                  url: creator.avatarUrl,
                                  name: creator.name,
                                  radius: 23,
                                ),
                                title: Text(creator.name),
                                subtitle: Text(
                                  '${creator.handle}${creator.role.isEmpty ? '' : ' · ${creator.role}'}',
                                ),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () => _openProfile(creator.id),
                              );
                            },
                          ),
                    _posts.isEmpty
                        ? const Center(
                            child: Text(
                              'Matching posts and opportunities appear here.',
                            ),
                          )
                        : ListView.builder(
                            itemCount: _posts.length,
                            itemBuilder: (context, index) => PostCard(
                              post: _posts[index],
                              repository: widget.repository,
                              openProfile: _openProfile,
                            ),
                          ),
                  ],
                ),
        ),
      ],
    ),
  );
}
