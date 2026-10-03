import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'blocked_users_screen.dart';
import 'chat_screen.dart';
import 'post_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.repository,
    required this.userId,
    required this.isSelf,
  });
  final AppRepository repository;
  final String userId;
  final bool isSelf;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileData {
  const _ProfileData(this.creator, this.posts, this.projects, this.following);
  final Creator creator;
  final List<SocialPost> posts;
  final List<Map<String, dynamic>> projects;
  final bool following;
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<_ProfileData> _future = _load();
  bool _busy = false;
  String? _error;

  Future<_ProfileData> _load() async {
    final creator = await widget.repository.loadProfile(
      profileId: widget.userId,
    );
    final results = await Future.wait<Object>([
      widget.repository.loadProfilePosts(widget.userId),
      widget.repository.loadProjects(widget.userId),
      if (!widget.isSelf) widget.repository.isFollowing(widget.userId),
    ]);
    return _ProfileData(
      creator,
      results[0] as List<SocialPost>,
      (results[1] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
      widget.isSelf ? false : results[2] as bool,
    );
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _signOut() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text('You can sign back in at any time.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await Supabase.instance.client.auth.signOut();
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not sign out. Please try again.');
      }
    }
  }

  Future<void> _follow(_ProfileData data) async {
    final next = !data.following;
    setState(() => _busy = true);
    try {
      await widget.repository.setFollowing(data.creator.id, next);
      _refresh();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not update follow. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _edit(Creator creator) async {
    final name = TextEditingController(text: creator.name);
    final handle = TextEditingController(text: creator.handle);
    final role = TextEditingController(text: creator.role);
    final bio = TextEditingController(text: creator.bio);
    final location = TextEditingController(text: creator.location);
    final pronouns = TextEditingController(text: creator.pronouns);
    final backstory = TextEditingController(text: creator.backstory);
    final age = TextEditingController(text: creator.age?.toString() ?? '');
    final height = TextEditingController(text: creator.height);
    final skills = TextEditingController(text: creator.skills.join(', '));
    final interests = TextEditingController(text: creator.interests.join(', '));
    final changed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit profile'),
        content: SizedBox(
          width: 480,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Name'),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: handle,
                  decoration: const InputDecoration(labelText: 'Handle'),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: role,
                  decoration: const InputDecoration(labelText: 'Role'),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: bio,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Bio'),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: location,
                  decoration: const InputDecoration(labelText: 'Location'),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: pronouns,
                  decoration: const InputDecoration(labelText: 'Pronouns'),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: age,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Age (optional)',
                  ),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: height,
                  decoration: const InputDecoration(
                    labelText: 'Height (optional)',
                  ),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: backstory,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Backstory'),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: skills,
                  decoration: const InputDecoration(
                    labelText: 'Skills (comma separated)',
                  ),
                ),
                const SizedBox(height: 9),
                TextField(
                  controller: interests,
                  decoration: const InputDecoration(
                    labelText: 'Interests (comma separated)',
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    final parsedAge = age.text.trim().isEmpty
        ? null
        : int.tryParse(age.text.trim());
    if (changed == true && age.text.trim().isNotEmpty && parsedAge == null) {
      if (mounted) {
        setState(
          () => _error = 'Age must be a whole number between 13 and 120.',
        );
      }
    } else if (changed == true) {
      setState(() => _busy = true);
      try {
        await widget.repository.updateProfile(
          name: name.text,
          handle: handle.text,
          role: role.text,
          bio: bio.text,
          location: location.text,
          pronouns: pronouns.text,
          backstory: backstory.text,
          age: parsedAge,
          height: height.text,
          skills: _split(skills.text),
          interests: _split(interests.text),
        );
        _refresh();
      } catch (error) {
        if (mounted) {
          setState(
            () => _error = error is FormatException
                ? error.message
                : 'Could not save profile changes.',
          );
        }
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }
    for (final field in [
      name,
      handle,
      role,
      bio,
      location,
      pronouns,
      backstory,
      age,
      height,
      skills,
      interests,
    ]) {
      field.dispose();
    }
  }

  List<String> _split(String value) => value
      .split(',')
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .take(20)
      .toList();

  Future<void> _changeAvatar() async {
    try {
      final image = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 86,
        maxWidth: 1600,
      );
      if (image == null) return;
      setState(() => _busy = true);
      await widget.repository.updateAvatar(image);
      _refresh();
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error is FormatException
              ? error.message
              : 'Could not update profile photo.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _message(Creator creator) async {
    setState(() => _busy = true);
    try {
      final conversationId = await widget.repository.startConversation(
        creator.id,
      );
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ChatScreen(
            repository: widget.repository,
            conversationId: conversationId,
            participant: creator,
          ),
        ),
      );
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not start this conversation.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addProject() async {
    final title = TextEditingController();
    final description = TextEditingController();
    final link = TextEditingController();
    final badge = TextEditingController(text: 'SHIPPED PROJECT');
    final save = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add a shipped project'),
        content: SizedBox(
          width: 460,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: title,
                  maxLength: 120,
                  decoration: const InputDecoration(labelText: 'Project title'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: description,
                  maxLength: 1000,
                  minLines: 2,
                  maxLines: 4,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: link,
                  decoration: const InputDecoration(
                    labelText: 'Project URL (HTTPS)',
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: badge,
                  maxLength: 80,
                  decoration: const InputDecoration(labelText: 'Badge'),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Add project'),
          ),
        ],
      ),
    );
    if (save == true) {
      setState(() => _busy = true);
      try {
        await widget.repository.addProject(
          title: title.text,
          description: description.text,
          link: link.text,
          badge: badge.text,
        );
        _refresh();
      } catch (error) {
        if (mounted) {
          setState(
            () => _error = error is FormatException
                ? error.message
                : 'Could not save this project.',
          );
        }
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }
    for (final field in [title, description, link, badge]) {
      field.dispose();
    }
  }

  Future<void> _deleteProject(String id) async {
    try {
      await widget.repository.deleteProject(id);
      _refresh();
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not delete this project.');
    }
  }

  Future<void> _block(Creator creator) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Block ${creator.name}?'),
        content: const Text(
          'Their posts will be hidden from your feed. You can unblock them later in your profile settings.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Block'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await widget.repository.blockUser(creator.id);
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not block this account.');
    }
  }

  Future<void> _blockProfile() async {
    try {
      await _block(await _future.then((data) => data.creator));
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not load this account to block it.');
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Profile'),
      actions: widget.isSelf
          ? [
              IconButton(
                tooltip: 'Blocked users',
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        BlockedUsersScreen(repository: widget.repository),
                  ),
                ),
                icon: const Icon(Icons.block_outlined),
              ),
              IconButton(
                tooltip: 'Sign out',
                onPressed: _signOut,
                icon: const Icon(Icons.logout_rounded),
              ),
            ]
          : [
              IconButton(
                tooltip: 'Block user',
                onPressed: _blockProfile,
                icon: const Icon(Icons.block_outlined),
              ),
            ],
    ),
    body: PageFrame(
      child: FutureBuilder<_ProfileData>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              !snapshot.hasData) {
            return const LoadingPanel(label: 'Loading profile…');
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Could not load this profile.'),
                  TextButton(
                    onPressed: _refresh,
                    child: const Text('Try again'),
                  ),
                ],
              ),
            );
          }
          final data = snapshot.data!;
          final creator = data.creator;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
              children: [
                Center(
                  child: GestureDetector(
                    onTap: widget.isSelf ? _changeAvatar : null,
                    child: Stack(
                      children: [
                        CreatorAvatar(
                          url: creator.avatarUrl,
                          name: creator.name,
                          radius: 46,
                        ),
                        if (widget.isSelf)
                          const Positioned(
                            right: 0,
                            bottom: 0,
                            child: CircleAvatar(
                              radius: 14,
                              child: Icon(Icons.edit, size: 14),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  creator.name,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                Text(
                  creator.handle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white60),
                ),
                if (creator.role.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    creator.role,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFF78BBFF)),
                  ),
                ],
                if (creator.location.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    creator.location,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white54),
                  ),
                ],
                if (creator.pronouns.isNotEmpty ||
                    creator.age != null ||
                    creator.height.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    [
                      creator.pronouns,
                      if (creator.age != null) '${creator.age} years old',
                      creator.height,
                    ].where((value) => value.isNotEmpty).join(' · '),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white54),
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _Metric(value: '${creator.followers}', label: 'Followers'),
                  ],
                ),
                const SizedBox(height: 14),
                if (creator.bio.isNotEmpty)
                  Text(
                    creator.bio,
                    textAlign: TextAlign.center,
                    style: const TextStyle(height: 1.45),
                  ),
                if (creator.backstory.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    creator.backstory,
                    textAlign: TextAlign.center,
                    style: const TextStyle(height: 1.45, color: Colors.white70),
                  ),
                ],
                if (creator.skills.isNotEmpty ||
                    creator.interests.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 7,
                    runSpacing: 7,
                    children: [...creator.skills, ...creator.interests]
                        .map(
                          (tag) => Chip(
                            label: Text(tag),
                            visualDensity: VisualDensity.compact,
                          ),
                        )
                        .toList(),
                  ),
                ],
                const SizedBox(height: 16),
                if (widget.isSelf)
                  FilledButton.tonalIcon(
                    onPressed: _busy ? null : () => _edit(creator),
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Edit profile'),
                  )
                else
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          onPressed: _busy ? null : () => _follow(data),
                          child: Text(data.following ? 'Following' : 'Follow'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : () => _message(creator),
                          icon: const Icon(Icons.mail_outline),
                          label: const Text('Message'),
                        ),
                      ),
                    ],
                  ),
                if (_error != null) InlineNotice(text: _error!, isError: true),
                const SizedBox(height: 22),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Shipped projects',
                        style: Theme.of(context).textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ),
                    if (widget.isSelf)
                      IconButton(
                        tooltip: 'Add project',
                        onPressed: _busy ? null : _addProject,
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                  ],
                ),
                if (data.projects.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'No projects shared yet.',
                      style: TextStyle(color: Colors.white54),
                    ),
                  ),
                for (final project in data.projects)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.rocket_launch_outlined),
                      title: Text(stringValue(project['title'], 'Project')),
                      subtitle: Text(
                        stringValue(project['description']),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: widget.isSelf
                          ? IconButton(
                              tooltip: 'Delete project',
                              onPressed: () =>
                                  _deleteProject(stringValue(project['id'])),
                              icon: const Icon(Icons.delete_outline),
                            )
                          : null,
                    ),
                  ),
                const SizedBox(height: 18),
                Text(
                  'Posts',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                if (data.posts.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'No posts yet.',
                      style: TextStyle(color: Colors.white54),
                    ),
                  ),
                for (final post in data.posts)
                  PostCard(
                    post: post,
                    repository: widget.repository,
                    openProfile: (_) {},
                    onDeleted: _refresh,
                  ),
              ],
            ),
          );
        },
      ),
    ),
  );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.value, required this.label});
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        value,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
      ),
      Text(label, style: const TextStyle(fontSize: 12, color: Colors.white54)),
    ],
  );
}
