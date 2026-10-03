import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';

class PostCard extends StatefulWidget {
  const PostCard({
    super.key,
    required this.post,
    required this.repository,
    required this.openProfile,
    this.onDeleted,
  });
  final SocialPost post;
  final AppRepository repository;
  final ValueChanged<String> openProfile;
  final VoidCallback? onDeleted;

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  late SocialPost _post = widget.post;
  bool _busy = false;

  @override
  void didUpdateWidget(covariant PostCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.post != widget.post) _post = widget.post;
  }

  Future<void> _like() async {
    if (_busy) return;
    final previous = _post;
    final next = !_post.likedByMe;
    setState(() {
      _busy = true;
      _post = _post.copyWith(
        likedByMe: next,
        likes: _post.likes + (next ? 1 : -1),
      );
    });
    try {
      await widget.repository.setLiked(_post, next);
    } catch (_) {
      if (mounted) {
        setState(() => _post = previous);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not update like. Please try again.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _repost() async {
    if (_busy) return;
    final next = !_post.repostedByMe;
    final previous = _post;
    setState(() {
      _busy = true;
      _post = _post.copyWith(
        repostedByMe: next,
        reposts: _post.reposts + (next ? 1 : -1),
      );
    });
    try {
      await widget.repository.setReposted(_post, next);
    } catch (_) {
      if (mounted) {
        setState(() => _post = previous);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not update repost. Please try again.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share() async {
    final content = _post.body.trim();
    try {
      await Clipboard.setData(
        ClipboardData(
          text: content.isEmpty ? _post.author : '${_post.author}: $content',
        ),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Post copied to clipboard.')),
        );
      }
    } on PlatformException {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not copy this post.')),
        );
      }
    }
  }

  Future<void> _comments() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: const Color(0xFF1D1B19),
      builder: (_) => CommentsSheet(post: _post, repository: widget.repository),
    );
    if (changed == true && mounted) {
      setState(() => _post = _post.copyWith(comments: _post.comments + 1));
    }
  }

  Future<void> _apply() async {
    final controller = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Introduce yourself'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          maxLength: 800,
          decoration: const InputDecoration(
            hintText: 'Tell them why you are interested…',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Send interest'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (text == null) return;
    setState(() => _busy = true);
    try {
      await widget.repository.applyToOpportunity(_post.id, text);
      if (mounted) {
        setState(() => _post = _post.copyWith(interestStatus: 'pending'));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Your interest was sent.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is FormatException
                  ? error.message
                  : 'Could not send interest.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this post?'),
        content: const Text('This post will be removed from the feed.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await widget.repository.softDeletePost(_post.id);
      widget.onDeleted?.call();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not delete this post.')),
        );
      }
    }
  }

  Future<void> _moderate(String action) async {
    final details = switch (action) {
      'hide' => (
        'Hide this post?',
        'This post will be removed from your feed.',
        'Hide',
      ),
      'report' => (
        'Report this post?',
        'Your report will be sent to the moderation team.',
        'Report',
      ),
      _ => (
        'Block ${_post.author}?',
        'Their posts will be hidden from your feed. You can unblock them in your profile.',
        'Block',
      ),
    };
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(details.$1),
        content: Text(details.$2),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(details.$3),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      if (action == 'hide') {
        await widget.repository.hidePost(_post.id);
        widget.onDeleted?.call();
      } else if (action == 'report') {
        await widget.repository.reportPost(_post.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Thanks. Your report was sent.')),
          );
        }
      } else {
        await widget.repository.blockUser(_post.authorId);
        if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'report'
                  ? 'Could not send this report.'
                  : 'Could not update this post preference.',
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final post = _post;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.white.withValues(alpha: 0.09)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (post.postKind == 'opportunity') ...[
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF329CFF).withValues(alpha: 0.1),
                    border: Border.all(
                      color: const Color(0xFF329CFF).withValues(alpha: 0.3),
                    ),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Text(
                    _opportunityLabel(post.opportunityKind),
                    style: const TextStyle(
                      color: Color(0xFF329CFF),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (post.opportunityStatus != null &&
                    post.opportunityStatus != 'open')
                  _Chip(
                    post.opportunityStatus == 'filled' ? 'Filled' : 'Paused',
                  ),
              ],
            ),
            if (post.opportunityTitle?.isNotEmpty ?? false) ...[
              const SizedBox(height: 8),
              Text(
                post.opportunityTitle!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  height: 1.5,
                ),
              ),
            ],
            if (post.opportunityRole?.isNotEmpty ?? false) ...[
              const SizedBox(height: 2),
              Text(
                [
                  post.opportunityRole!,
                  if (post.opportunityCommitment?.isNotEmpty ?? false)
                    _humanize(post.opportunityCommitment!),
                  if (post.opportunityWorkMode?.isNotEmpty ?? false)
                    post.opportunityWorkMode!.replaceAll('_', ' '),
                  if (post.opportunityLocation?.isNotEmpty ?? false)
                    post.opportunityLocation!,
                ].join(' · '),
                style: const TextStyle(
                  color: Color(0xFFAAA49D),
                  fontSize: 12,
                  height: 1.6,
                ),
              ),
            ],
            if (post.opportunitySkills.isNotEmpty) ...[
              const SizedBox(height: 6),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: post.opportunitySkills.map(_Chip.new).toList(),
              ),
            ],
            if (post.opportunityCompensation?.isNotEmpty ?? false) ...[
              const SizedBox(height: 6),
              Text(
                'Compensation: ${post.opportunityCompensation}',
                style: const TextStyle(color: Color(0xFFD0CBC5), fontSize: 12),
              ),
            ],
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              InkWell(
                borderRadius: BorderRadius.circular(40),
                onTap: () => widget.openProfile(post.authorId),
                child: CreatorAvatar(
                  url: post.avatarUrl,
                  name: post.author,
                  radius: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: InkWell(
                  onTap: () => widget.openProfile(post.authorId),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        post.author,
                        style: const TextStyle(
                          fontSize: 14,
                          height: 1.2,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        post.authorBio.trim().isEmpty
                            ? 'No bio yet'
                            : post.authorBio.trim().replaceAll(
                                RegExp(r'\s+'),
                                ' ',
                              ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: const Color(0xFFAAA49D),
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_horiz, size: 20),
                onSelected: (value) {
                  if (value == 'delete') {
                    _delete();
                  } else {
                    _moderate(value);
                  }
                },
                itemBuilder: (_) => post.isMine
                    ? const [
                        PopupMenuItem(
                          value: 'delete',
                          child: Text('Delete post'),
                        ),
                      ]
                    : const [
                        PopupMenuItem(
                          value: 'hide',
                          child: Text('Not interested'),
                        ),
                        PopupMenuItem(
                          value: 'report',
                          child: Text('Report post'),
                        ),
                        PopupMenuItem(
                          value: 'block',
                          child: Text('Block creator'),
                        ),
                      ],
              ),
            ],
          ),
          if (post.body.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              post.body,
              style: const TextStyle(
                color: Color(0xFFEEEAE5),
                fontSize: 14,
                height: 1.55,
              ),
            ),
          ],
          if (post.tags.isNotEmpty) ...[
            const SizedBox(height: 9),
            Wrap(
              spacing: 8,
              children: post.tags
                  .map(
                    (tag) => Text(
                      tag,
                      style: const TextStyle(color: Color(0xFF78BBFF)),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (post.mediaUrls.isNotEmpty) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AspectRatio(
                aspectRatio: 1.35,
                child: Image.network(
                  post.mediaUrls.first,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const ColoredBox(
                    color: Colors.white10,
                    child: Center(child: Icon(Icons.broken_image_outlined)),
                  ),
                ),
              ),
            ),
          ],
          if (post.postKind == 'opportunity' && !post.isMine) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: post.interestStatus == null ? _apply : null,
                child: Text(
                  post.interestStatus == null
                      ? 'I’m interested'
                      : 'Interest ${post.interestStatus}',
                ),
              ),
            ),
          ],
          const SizedBox(height: 2),
          Row(
            children: [
              _Action(
                icon: post.likedByMe ? Icons.favorite : Icons.favorite_border,
                active: post.likedByMe,
                label: '${post.likes}',
                onTap: _like,
              ),
              const SizedBox(width: 14),
              _Action(
                icon: Icons.mode_comment_outlined,
                label: '${post.comments}',
                onTap: _comments,
              ),
              const SizedBox(width: 14),
              _Action(
                icon: Icons.repeat_rounded,
                active: post.repostedByMe,
                label: '${post.reposts}',
                onTap: _repost,
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Share post',
                onPressed: _share,
                icon: const Icon(Icons.share_outlined, size: 18),
                color: const Color(0xFFA9A39C),
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints.tightFor(
                  width: 34,
                  height: 34,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const _Action({
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(6),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 18,
            color: active ? const Color(0xFFFF6B82) : const Color(0xFFA9A39C),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(color: Color(0xFFA9A39C), fontSize: 12),
          ),
        ],
      ),
    ),
  );
}

class _Chip extends StatelessWidget {
  const _Chip(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      border: Border.all(color: Colors.white.withValues(alpha: 0.09)),
      borderRadius: BorderRadius.circular(30),
    ),
    child: Text(
      label.replaceAll('_', ' '),
      style: const TextStyle(fontSize: 11, color: Color(0xFFD0CBC5)),
    ),
  );
}

String _opportunityLabel(String? kind) => switch (kind) {
  'cofounder' => 'Co-founder',
  'collaborator' => 'Creative collaborator',
  'feedback' => 'Feedback',
  'client' => 'Clients or customers',
  'other' => 'Something else',
  _ => 'Looking for',
};

String _humanize(String value) {
  final label = value.replaceAll('_', '-');
  return label.isEmpty
      ? label
      : '${label[0].toUpperCase()}${label.substring(1)}';
}

class CommentsSheet extends StatefulWidget {
  const CommentsSheet({
    super.key,
    required this.post,
    required this.repository,
  });
  final SocialPost post;
  final AppRepository repository;

  @override
  State<CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<CommentsSheet> {
  final _controller = TextEditingController();
  List<SocialComment> _comments = [];
  SocialComment? _replyTo;
  bool _loading = true;
  bool _sending = false;
  bool _hasAdded = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final comments = await widget.repository.loadComments(widget.post.id);
      if (mounted) {
        setState(() {
          _comments = comments;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Could not load comments.';
        });
      }
    }
  }

  Future<void> _send() async {
    if (_sending || _controller.text.trim().isEmpty) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final comment = await widget.repository.addComment(
        widget.post.id,
        _controller.text,
        parentId: _replyTo?.id,
      );
      if (!mounted) return;
      setState(() {
        _comments = [..._comments, comment];
        _controller.clear();
        _replyTo = null;
        _hasAdded = true;
      });
    } on FormatException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not send comment. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _delete(SocialComment comment) async {
    try {
      await widget.repository.deleteComment(comment);
      if (mounted) {
        setState(
          () => _comments.removeWhere(
            (item) => item.id == comment.id || item.parentId == comment.id,
          ),
        );
      }
    } on AuthException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not delete comment.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final topLevel = _comments
        .where((comment) => comment.parentId == null)
        .toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.82,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Comments · ${_comments.length}',
                      style: Theme.of(context).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context, _hasAdded),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            if (_error != null) InlineNotice(text: _error!, isError: true),
            Expanded(
              child: _loading
                  ? const LoadingPanel(label: 'Loading comments…')
                  : topLevel.isEmpty
                  ? const Center(child: Text('Start the conversation.'))
                  : ListView(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      children: topLevel.map((comment) {
                        final replies = _comments
                            .where((item) => item.parentId == comment.id)
                            .toList();
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _CommentTile(
                              comment: comment,
                              onReply: () => setState(() => _replyTo = comment),
                              onDelete: comment.isMine
                                  ? () => _delete(comment)
                                  : null,
                            ),
                            for (final reply in replies)
                              Padding(
                                padding: const EdgeInsets.only(left: 38),
                                child: _CommentTile(
                                  comment: reply,
                                  onReply: () =>
                                      setState(() => _replyTo = comment),
                                  onDelete: reply.isMine
                                      ? () => _delete(reply)
                                      : null,
                                ),
                              ),
                            const Divider(height: 12),
                          ],
                        );
                      }).toList(),
                    ),
            ),
            if (_replyTo != null)
              ListTile(
                dense: true,
                title: Text(
                  'Replying to ${_replyTo!.author}',
                  style: const TextStyle(color: Colors.white70),
                ),
                trailing: IconButton(
                  onPressed: () => setState(() => _replyTo = null),
                  icon: const Icon(Icons.close, size: 18),
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      maxLength: 1000,
                      decoration: InputDecoration(
                        hintText: _replyTo == null
                            ? 'Write a comment…'
                            : 'Write a reply…',
                        counterText: '',
                      ),
                      onSubmitted: (_) => _send(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _sending ? null : _send,
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CommentTile extends StatelessWidget {
  const _CommentTile({
    required this.comment,
    required this.onReply,
    this.onDelete,
  });
  final SocialComment comment;
  final VoidCallback onReply;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const CreatorAvatar(radius: 17),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${comment.author}  ${relativeTime(comment.createdAt)}',
                style: const TextStyle(fontSize: 12, color: Colors.white60),
              ),
              const SizedBox(height: 4),
              Text(comment.body, style: const TextStyle(height: 1.4)),
              TextButton(
                onPressed: onReply,
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(45, 28),
                ),
                child: const Text('Reply'),
              ),
            ],
          ),
        ),
        if (onDelete != null)
          IconButton(
            tooltip: 'Delete comment',
            visualDensity: VisualDensity.compact,
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline, size: 18),
          ),
      ],
    ),
  );
}
