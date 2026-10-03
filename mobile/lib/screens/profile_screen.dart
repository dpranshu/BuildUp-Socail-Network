import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'blocked_users_screen.dart';
import 'chat_screen.dart';
import 'create_screen.dart';
import 'post_card.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.repository,
    required this.userId,
    required this.isSelf,
    this.onSelfProfileLoaded,
  });
  final AppRepository repository;
  final String userId;
  final bool isSelf;
  final ValueChanged<Creator>? onSelfProfileLoaded;

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
  String _section = 'posts';
  bool _busy = false;
  bool? _followingOverride;
  int? _followersOverride;
  String? _error;

  Future<_ProfileData> _load() async {
    final results = await Future.wait<Object>([
      widget.repository.loadProfile(profileId: widget.userId),
      widget.repository.loadProfilePosts(widget.userId),
      widget.repository.loadProjects(widget.userId),
      if (!widget.isSelf) widget.repository.isFollowing(widget.userId),
    ]);
    final creator = results[0] as Creator;
    if (widget.isSelf) widget.onSelfProfileLoaded?.call(creator);
    return _ProfileData(
      creator,
      results[1] as List<SocialPost>,
      (results[2] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList(),
      widget.isSelf ? false : results[3] as bool,
    );
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

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

  void _openConnections(String type) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: const Color(0xFF1D1B19),
      builder: (_) => FractionallySizedBox(
        heightFactor: 0.82,
        child: _ConnectionsSheet(
          repository: widget.repository,
          profileId: widget.userId,
          type: type,
          onFollowChanged: _refresh,
          openProfile: (userId) {
            Navigator.of(context).pop();
            _openProfile(userId);
          },
        ),
      ),
    );
  }

  Widget _sectionTab(String value, String label) => Expanded(
    child: InkWell(
      onTap: () => setState(() => _section = value),
      child: SizedBox(
        height: 44,
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: Text(
                  label,
                  style: TextStyle(
                    color: _section == value ? Colors.white : Colors.white60,
                    fontSize: 13,
                    fontWeight: _section == value
                        ? FontWeight.w600
                        : FontWeight.w400,
                  ),
                ),
              ),
            ),
            Container(
              height: 2,
              color: _section == value ? Colors.white : Colors.transparent,
            ),
          ],
        ),
      ),
    ),
  );

  Widget _overviewHeading(String title) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(
      title,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
    ),
  );

  Widget _overviewPanel(Widget child) => Container(
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.025),
      border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
    ),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    child: child,
  );

  Widget _infoRow(
    IconData? icon,
    String label,
    String value, {
    Color valueColor = const Color(0xFFF5F2EE),
    bool last = false,
  }) => Container(
    constraints: const BoxConstraints(minHeight: 44),
    decoration: last
        ? null
        : BoxDecoration(
            border: Border(
              bottom: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
            ),
          ),
    child: Row(
      children: [
        if (icon != null) ...[
          Icon(icon, size: 16, color: const Color(0xFF329CFF)),
          const SizedBox(width: 12),
        ],
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: Color(0xFFD7D1CA), fontSize: 13),
          ),
        ),
        Text(
          value,
          textAlign: TextAlign.right,
          style: TextStyle(color: valueColor, fontSize: 13),
        ),
      ],
    ),
  );

  Widget _projectCard(Map<String, dynamic> project, {VoidCallback? onDelete}) {
    final badge = stringValue(project['badge'], 'SHIPPED PROJECT');
    final createdAt = DateTime.tryParse(stringValue(project['created_at']))
        ?.toLocal();
    final link = stringValue(project['link']);
    final dateLabel = createdAt == null
        ? ''
        : '${_monthName(createdAt.month)} ${createdAt.year}';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.025),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.circle, size: 7, color: Color(0xFF329CFF)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  badge.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF329CFF),
                    fontSize: 10,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (dateLabel.isNotEmpty)
                Text(
                  dateLabel,
                  style: const TextStyle(
                    color: Color(0xFFAAA49D),
                    fontSize: 11,
                  ),
                ),
              if (onDelete != null)
                IconButton(
                  tooltip: 'Delete project',
                  onPressed: onDelete,
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.delete_outline, size: 18),
                ),
            ],
          ),
          const SizedBox(height: 7),
          Text(
            stringValue(project['title'], 'Project'),
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
          ),
          if (stringValue(project['description']).isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              stringValue(project['description']),
              style: const TextStyle(
                color: Color(0xFFC8C1B9),
                fontSize: 13,
                height: 1.55,
              ),
            ),
          ],
          if (link.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Divider(height: 1),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => _openProjectLink(link),
                icon: const Icon(Icons.open_in_new, size: 15),
                label: Text(
                  Uri.tryParse(link)?.host ?? 'Open project',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  String _monthName(int month) => const [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][month - 1];

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
    if (_busy) return;
    final currentFollowing = _followingOverride ?? data.following;
    final previousFollowers = _followersOverride ?? data.creator.followers;
    final next = !currentFollowing;
    setState(() {
      _busy = true;
      _followingOverride = next;
      _followersOverride = (previousFollowers + (next ? 1 : -1))
          .clamp(0, 0x7fffffff)
          .toInt();
      _error = null;
    });
    try {
      await widget.repository.setFollowing(data.creator.id, next);
      _refresh();
    } catch (_) {
      if (mounted) {
        setState(() {
          _followingOverride = currentFollowing;
          _followersOverride = previousFollowers;
          _error = 'Could not update follow. Please try again.';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _edit(Creator creator) async {
    final name = TextEditingController(text: creator.name);
    final handle = TextEditingController(
      text: creator.handle.replaceFirst(RegExp(r'^@+'), ''),
    );
    final role = TextEditingController(text: creator.role);
    final bio = TextEditingController(text: creator.bio);
    final location = TextEditingController(text: creator.location);
    final backstory = TextEditingController(text: creator.backstory);
    final age = TextEditingController(text: creator.age?.toString() ?? '');
    final height = TextEditingController(text: creator.height);
    final skills = TextEditingController(text: creator.skills.join(', '));
    final interests = TextEditingController(text: creator.interests.join(', '));
    final avatarUrl = TextEditingController(text: creator.avatarUrl ?? '');
    const pronounChoices = [
      'he/him',
      'she/her',
      'they/them',
      'any pronouns',
      'prefer not to say',
    ];
    final normalizedPronouns = creator.pronouns.toLowerCase().trim();
    var pronounChoice = pronounChoices.contains(normalizedPronouns)
        ? normalizedPronouns
        : creator.pronouns.isEmpty
        ? 'he/him'
        : 'other';
    final customPronouns = TextEditingController(
      text: pronounChoice == 'other' ? creator.pronouns : '',
    );
    final changed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Edit profile'),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: name,
                    maxLength: 80,
                    decoration: const InputDecoration(labelText: 'Name'),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: handle,
                    maxLength: 39,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      prefixText: '@',
                    ),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: role,
                    maxLength: 80,
                    decoration: const InputDecoration(labelText: 'Role'),
                  ),
                  const SizedBox(height: 9),
                  DropdownButtonFormField<String>(
                    initialValue: pronounChoice,
                    decoration: const InputDecoration(labelText: 'Pronouns'),
                    items: [
                      for (final choice in pronounChoices)
                        DropdownMenuItem(value: choice, child: Text(choice)),
                      const DropdownMenuItem(
                        value: 'other',
                        child: Text('Other'),
                      ),
                    ],
                    onChanged: (value) => setDialogState(
                      () => pronounChoice = value ?? pronounChoice,
                    ),
                  ),
                  if (pronounChoice == 'other') ...[
                    const SizedBox(height: 9),
                    TextField(
                      controller: customPronouns,
                      maxLength: 40,
                      decoration: const InputDecoration(
                        labelText: 'Your pronouns',
                      ),
                    ),
                  ],
                  const SizedBox(height: 9),
                  TextField(
                    controller: location,
                    maxLength: 120,
                    decoration: const InputDecoration(labelText: 'Location'),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: age,
                    maxLength: 3,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Age',
                      hintText: '13–120',
                    ),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: height,
                    maxLength: 24,
                    decoration: const InputDecoration(labelText: 'Height'),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: avatarUrl,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Avatar URL',
                      hintText: 'https://',
                    ),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: bio,
                    maxLength: 500,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(labelText: 'Bio'),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: backstory,
                    maxLength: 1500,
                    minLines: 2,
                    maxLines: 5,
                    decoration: const InputDecoration(labelText: 'Backstory'),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: skills,
                    decoration: const InputDecoration(
                      labelText: 'Skills, separated by commas',
                      helperText: 'Used to suggest collaborators.',
                    ),
                  ),
                  const SizedBox(height: 9),
                  TextField(
                    controller: interests,
                    decoration: const InputDecoration(
                      labelText: 'Interests, separated by commas',
                      helperText: 'Used to suggest collaborators.',
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
              child: const Text('Save profile'),
            ),
          ],
        ),
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
          pronouns: pronounChoice == 'other'
              ? customPronouns.text
              : pronounChoice,
          backstory: backstory.text,
          age: parsedAge,
          height: height.text,
          skills: _split(skills.text),
          interests: _split(interests.text),
          avatarUrl: avatarUrl.text,
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
      backstory,
      age,
      height,
      skills,
      interests,
      avatarUrl,
      customPronouns,
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
        if (error is StateError &&
            error.message.startsWith('Profile photo updated,')) {
          _refresh();
          setState(() => _error = error.message);
        } else {
          setState(
            () => _error = error is FormatException
                ? error.message
                : 'Could not update profile photo.',
          );
        }
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
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete project?'),
        content: const Text('This project will be removed from your profile.'),
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
    if (confirmed != true) return;
    try {
      await widget.repository.deleteProject(id);
      _refresh();
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not delete this project.');
    }
  }

  Future<void> _openProjectLink(String value) async {
    final uri = Uri.tryParse(value);
    if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
      setState(() => _error = 'This project link is invalid.');
      return;
    }
    try {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw StateError('No application could open this link.');
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not open this project link.');
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
    body: Row(
      children: [
        if (MediaQuery.sizeOf(context).width >= 640)
          AppNavigationRail(
            selectedIndex: AppNavigation.activeTab,
            unreadMessages: AppNavigation.unreadMessages,
            onTap: AppNavigation.navigateToTab,
          ),
        Expanded(
          child: PageFrame(
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
                final isFollowing = _followingOverride ?? data.following;
                final followers = _followersOverride ?? creator.followers;
                return RefreshIndicator(
                  onRefresh: () async => _refresh(),
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 30),
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                GestureDetector(
                                  onTap: widget.isSelf && !_busy
                                      ? _changeAvatar
                                      : null,
                                  child: Stack(
                                    children: [
                                      CreatorAvatar(
                                        url: creator.avatarUrl,
                                        name: creator.name,
                                        radius: 40,
                                      ),
                                      if (widget.isSelf)
                                        Positioned(
                                          right: 0,
                                          bottom: 0,
                                          child: CircleAvatar(
                                            radius: 12,
                                            backgroundColor: const Color(
                                              0xFF329CFF,
                                            ),
                                            child: Icon(
                                              _busy
                                                  ? Icons.hourglass_top
                                                  : Icons.camera_alt_outlined,
                                              size: 13,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                const Spacer(),
                                if (widget.isSelf)
                                  IconButton(
                                    tooltip: 'Edit profile',
                                    onPressed: _busy
                                        ? null
                                        : () => _edit(creator),
                                    icon: const Icon(Icons.edit_outlined),
                                  )
                                else ...[
                                  OutlinedButton.icon(
                                    onPressed: _busy
                                        ? null
                                        : () => _message(creator),
                                    icon: const Icon(
                                      Icons.chat_bubble_outline,
                                      size: 16,
                                    ),
                                    label: const Text('Message'),
                                  ),
                                  const SizedBox(width: 8),
                                  FilledButton(
                                    onPressed: _busy
                                        ? null
                                        : () => _follow(data),
                                    child: Text(
                                      isFollowing ? 'Following' : 'Follow',
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    creator.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .headlineSmall
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                ),
                                if (creator.verified) ...[
                                  const SizedBox(width: 6),
                                  const Icon(
                                    Icons.verified,
                                    size: 18,
                                    color: Color(0xFF329CFF),
                                  ),
                                ],
                              ],
                            ),
                            if (creator.role.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                creator.role,
                                style: const TextStyle(
                                  color: Color(0xFF78BBFF),
                                ),
                              ),
                            ],
                            const SizedBox(height: 3),
                            Text(
                              [
                                creator.handle,
                                if (creator.pronouns.isNotEmpty)
                                  creator.pronouns,
                              ].join(' · '),
                              style: const TextStyle(
                                color: Color(0xFFAAA49D),
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 13),
                            Text(
                              creator.bio.isEmpty
                                  ? 'Share what you make and what you are learning.'
                                  : creator.bio,
                              style: const TextStyle(
                                color: Color(0xFFD7D1CA),
                                fontSize: 14,
                                height: 1.65,
                              ),
                            ),
                            if (creator.location.isNotEmpty ||
                                creator.age != null) ...[
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 16,
                                runSpacing: 8,
                                children: [
                                  if (creator.location.isNotEmpty)
                                    _ProfileMetadata(
                                      icon: Icons.location_on_outlined,
                                      value: creator.location,
                                    ),
                                  if (creator.age != null)
                                    _ProfileMetadata(
                                      icon: Icons.cake_outlined,
                                      value: '${creator.age}',
                                    ),
                                ],
                              ),
                            ],
                            const SizedBox(height: 14),
                            Wrap(
                              spacing: 18,
                              children: [
                                TextButton(
                                  onPressed: () =>
                                      _openConnections('followers'),
                                  child: _Metric(
                                    value: '$followers',
                                    label: 'Followers',
                                  ),
                                ),
                                TextButton(
                                  onPressed: () =>
                                      _openConnections('following'),
                                  child: _Metric(
                                    value: '${creator.followingCount}',
                                    label: 'Following',
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            if (_error != null)
                              InlineNotice(text: _error!, isError: true),
                            const SizedBox(height: 22),
                            Container(
                              decoration: BoxDecoration(
                                border: Border(
                                  top: BorderSide(
                                    color: Colors.white.withValues(alpha: 0.08),
                                  ),
                                  bottom: BorderSide(
                                    color: Colors.white.withValues(alpha: 0.08),
                                  ),
                                ),
                              ),
                              child: Row(
                                children: [
                                  _sectionTab('posts', 'Posts'),
                                  _sectionTab('overview', 'Overview'),
                                  _sectionTab('projects', 'Shipped Projects'),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                            if (_section == 'overview') ...[
                              _overviewHeading('Backstory'),
                              _overviewPanel(
                                Text(
                                  creator.backstory.isEmpty
                                      ? 'A little about your path, the things you are learning, and what keeps you building.'
                                      : creator.backstory,
                                  style: const TextStyle(
                                    height: 1.7,
                                    color: Color(0xFFD7D1CA),
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 22),
                              _overviewHeading('Basic Information'),
                              _overviewPanel(
                                Column(
                                  children: [
                                    _infoRow(
                                      Icons.cake_outlined,
                                      'Age',
                                      creator.age?.toString() ?? 'Not added',
                                    ),
                                    _infoRow(
                                      Icons.straighten_outlined,
                                      'Height',
                                      creator.height.isEmpty
                                          ? 'Not added'
                                          : creator.height,
                                    ),
                                    InkWell(
                                      onTap: () =>
                                          setState(() => _section = 'projects'),
                                      child: _infoRow(
                                        Icons.open_in_new,
                                        'Shipped Projects',
                                        '${data.projects.length} projects  ›',
                                        valueColor: const Color(0xFF329CFF),
                                      ),
                                    ),
                                    _infoRow(
                                      Icons.location_on_outlined,
                                      'Location',
                                      creator.location.isEmpty
                                          ? 'Not added'
                                          : creator.location,
                                      last: true,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 22),
                              _overviewHeading('Skills'),
                              _overviewPanel(
                                creator.skills.isEmpty
                                    ? const Padding(
                                        padding: EdgeInsets.symmetric(
                                          vertical: 4,
                                        ),
                                        child: Text(
                                          'Add the skills you want collaborators to find.',
                                          style: TextStyle(
                                            color: Color(0xFFAAA49D),
                                            fontSize: 13,
                                          ),
                                        ),
                                      )
                                    : Column(
                                        children: [
                                          for (
                                            var index = 0;
                                            index < creator.skills.length;
                                            index++
                                          )
                                            _infoRow(
                                              null,
                                              creator.skills[index],
                                              index == 0 ? 'Core skill' : '',
                                              last:
                                                  index ==
                                                  creator.skills.length - 1,
                                            ),
                                        ],
                                      ),
                              ),
                              const SizedBox(height: 22),
                              _overviewHeading('Interest / Hobby'),
                              _overviewPanel(
                                creator.interests.isEmpty
                                    ? const Padding(
                                        padding: EdgeInsets.symmetric(
                                          vertical: 4,
                                        ),
                                        child: Text(
                                          'Add a few things you enjoy outside your work.',
                                          style: TextStyle(
                                            color: Color(0xFFAAA49D),
                                            fontSize: 13,
                                          ),
                                        ),
                                      )
                                    : Column(
                                        children: [
                                          for (
                                            var index = 0;
                                            index < creator.interests.length;
                                            index++
                                          )
                                            _infoRow(
                                              null,
                                              creator.interests[index],
                                              '',
                                              last:
                                                  index ==
                                                  creator.interests.length - 1,
                                            ),
                                        ],
                                      ),
                              ),
                              if (data.projects.isNotEmpty) ...[
                                const SizedBox(height: 22),
                                _projectCard(data.projects.first),
                              ],
                            ],
                            if (_section == 'projects') ...[
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Shipped Projects',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleLarge
                                          ?.copyWith(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ),
                                  if (widget.isSelf)
                                    OutlinedButton.icon(
                                      onPressed: _busy ? null : _addProject,
                                      icon: const Icon(Icons.add, size: 16),
                                      label: const Text('Add project'),
                                    ),
                                ],
                              ),
                              if (data.projects.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 22),
                                  child: Center(
                                    child: Text(
                                      'No shipped projects yet.',
                                      style: TextStyle(color: Colors.white54),
                                    ),
                                  ),
                                ),
                              for (final project in data.projects)
                                _projectCard(
                                  project,
                                  onDelete: widget.isSelf
                                      ? () => _deleteProject(
                                          stringValue(project['id']),
                                        )
                                      : null,
                                ),
                            ],
                            if (_section == 'posts') ...[
                              Text(
                                'Posts',
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(fontWeight: FontWeight.bold),
                              ),
                              if (data.posts.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 12),
                                  child: Text(
                                    'No posts or reposts yet.',
                                    style: TextStyle(color: Colors.white54),
                                  ),
                                ),
                              if (data.posts.isEmpty && widget.isSelf)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: OutlinedButton.icon(
                                    onPressed: () => Navigator.of(context).push(
                                      MaterialPageRoute<void>(
                                        builder: (_) => CreateScreen(
                                          repository: widget.repository,
                                          onPosted: _refresh,
                                        ),
                                      ),
                                    ),
                                    icon: const Icon(Icons.edit_outlined),
                                    label: const Text('Write your first post'),
                                  ),
                                ),
                            ],
                          ],
                        ),
                      ),
                      if (_section == 'posts')
                        for (final post in data.posts)
                          PostCard(
                            key: ValueKey(
                              '${post.id}-${post.repostInfo == null ? 'post' : 'repost'}',
                            ),
                            post: post,
                            repository: widget.repository,
                            openProfile: _openProfile,
                            allowRemoveRepost:
                                widget.isSelf && post.repostInfo != null,
                            onDeleted: _refresh,
                          ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
      ],
    ),
    bottomNavigationBar: MediaQuery.sizeOf(context).width >= 640
        ? null
        : AppBottomNavigationBar(
            selectedIndex: AppNavigation.activeTab,
            unreadMessages: AppNavigation.unreadMessages,
            onTap: AppNavigation.navigateToTab,
          ),
  );
}

class _ConnectionsSheet extends StatefulWidget {
  const _ConnectionsSheet({
    required this.repository,
    required this.profileId,
    required this.type,
    required this.onFollowChanged,
    required this.openProfile,
  });

  final AppRepository repository;
  final String profileId;
  final String type;
  final VoidCallback onFollowChanged;
  final ValueChanged<String> openProfile;

  @override
  State<_ConnectionsSheet> createState() => _ConnectionsSheetState();
}

class _ConnectionsSheetState extends State<_ConnectionsSheet> {
  late Future<SocialConnectionPage> _future = _loadFirstPage();
  final List<SocialConnection> _morePeople = [];
  String? _cursorCreatedAt;
  String? _cursorId;
  String? _error;
  String? _updatingId;
  final Map<String, bool> _followOverrides = {};
  bool _hasMore = false;
  bool _loadingMore = false;

  Future<SocialConnectionPage> _loadFirstPage() async {
    final page = await widget.repository.loadConnections(
      profileId: widget.profileId,
      type: widget.type,
    );
    _cursorCreatedAt = page.cursorCreatedAt;
    _cursorId = page.cursorId;
    _hasMore = page.hasMore;
    return page;
  }

  Future<void> _loadMore() async {
    if (!_hasMore ||
        _loadingMore ||
        _cursorCreatedAt == null ||
        _cursorId == null) {
      return;
    }
    setState(() {
      _loadingMore = true;
      _error = null;
    });
    try {
      final page = await widget.repository.loadConnections(
        profileId: widget.profileId,
        type: widget.type,
        beforeCreatedAt: _cursorCreatedAt,
        beforeId: _cursorId,
      );
      if (!mounted) return;
      setState(() {
        _morePeople.addAll(page.people);
        _cursorCreatedAt = page.cursorCreatedAt;
        _cursorId = page.cursorId;
        _hasMore = page.hasMore;
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load more connections.');
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _toggleFollow(SocialConnection person) async {
    setState(() {
      _updatingId = person.creator.id;
      _error = null;
    });
    try {
      await widget.repository.setFollowing(
        person.creator.id,
        !person.isFollowing,
      );
      if (!mounted) return;
      setState(() {
        _followOverrides[person.creator.id] = !person.isFollowing;
      });
      widget.onFollowChanged();
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not update follow status.');
    } finally {
      if (mounted) setState(() => _updatingId = null);
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<SocialConnectionPage>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.waiting &&
          !snapshot.hasData) {
        return const LoadingPanel(label: 'Loading connections…');
      }
      if (snapshot.hasError || !snapshot.hasData) {
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Unable to load connections.'),
              TextButton(
                onPressed: () => setState(() {
                  _morePeople.clear();
                  _future = _loadFirstPage();
                }),
                child: const Text('Try again'),
              ),
            ],
          ),
        );
      }

      final page = snapshot.data!;
      final people = [...page.people, ..._morePeople];
      return Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.type == 'followers' ? 'Followers' : 'Following',
                    style: Theme.of(context).textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  tooltip: 'Close connections',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          if (_error != null) InlineNotice(text: _error!, isError: true),
          Expanded(
            child: people.isEmpty
                ? Center(
                    child: Text(
                      widget.type == 'followers'
                          ? 'No followers yet.'
                          : 'Not following anyone yet.',
                      style: const TextStyle(color: Colors.white60),
                    ),
                  )
                : ListView.builder(
                    itemCount:
                        people.length + (_hasMore || _loadingMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == people.length) {
                        return Padding(
                          padding: const EdgeInsets.all(12),
                          child: Center(
                            child: _loadingMore
                                ? const CircularProgressIndicator()
                                : TextButton(
                                    onPressed: _loadMore,
                                    child: const Text('Load more'),
                                  ),
                          ),
                        );
                      }
                      final connection = people[index];
                      final creator = connection.creator;
                      final isFollowing =
                          _followOverrides[creator.id] ??
                          connection.isFollowing;
                      return ListTile(
                        leading: CreatorAvatar(
                          url: creator.avatarUrl,
                          name: creator.name,
                          radius: 22,
                        ),
                        title: Row(
                          children: [
                            Flexible(
                              child: Text(
                                creator.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (creator.verified) ...[
                              const SizedBox(width: 5),
                              const Icon(
                                Icons.verified,
                                size: 14,
                                color: Color(0xFF329CFF),
                              ),
                            ],
                          ],
                        ),
                        subtitle: Text(creator.handle),
                        onTap: () => widget.openProfile(creator.id),
                        trailing: connection.isCurrentUser
                            ? const Text('You')
                            : OutlinedButton(
                                onPressed: _updatingId == null
                                    ? () => _toggleFollow(
                                        connection.copyWith(
                                          isFollowing: isFollowing,
                                        ),
                                      )
                                    : null,
                                child: Text(
                                  isFollowing ? 'Unfollow' : 'Follow',
                                ),
                              ),
                      );
                    },
                  ),
          ),
        ],
      );
    },
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

class _ProfileMetadata extends StatelessWidget {
  const _ProfileMetadata({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 14, color: const Color(0xFF329CFF)),
      const SizedBox(width: 5),
      Text(
        value,
        style: const TextStyle(color: Color(0xFFAAA49D), fontSize: 12),
      ),
    ],
  );
}
