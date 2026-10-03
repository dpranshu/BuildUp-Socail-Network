import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'post_card.dart';
import 'profile_screen.dart';

class PostDetailScreen extends StatefulWidget {
  const PostDetailScreen({
    super.key,
    required this.repository,
    required this.postId,
  });

  final AppRepository repository;
  final String postId;

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  late Future<SocialPost?> _future = widget.repository.loadPost(widget.postId);

  void _openProfile(String userId) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProfileScreen(
          repository: widget.repository,
          userId: userId,
          isSelf: userId == widget.repository.userId,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Post')),
    body: PageFrame(
      child: FutureBuilder<SocialPost?>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingPanel(label: 'Loading post…');
          }
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('This post could not be loaded.'),
                  TextButton(
                    onPressed: () => setState(
                      () => _future = widget.repository.loadPost(widget.postId),
                    ),
                    child: const Text('Try again'),
                  ),
                ],
              ),
            );
          }
          final post = snapshot.data;
          if (post == null) {
            return const Center(child: Text('This post is no longer available.'));
          }
          return ListView(
            padding: const EdgeInsets.only(top: 12, bottom: 24),
            children: [
              PostCard(
                post: post,
                repository: widget.repository,
                openProfile: _openProfile,
                onDeleted: () => Navigator.of(context).maybePop(),
              ),
            ],
          );
        },
      ),
    ),
  );
}
