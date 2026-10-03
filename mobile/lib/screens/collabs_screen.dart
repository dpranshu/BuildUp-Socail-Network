import 'dart:async';

import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'chat_screen.dart';
import 'post_card.dart';

class CollabsScreen extends StatefulWidget {
  const CollabsScreen({
    super.key,
    required this.repository,
    required this.openProfile,
    required this.postOpportunity,
    this.initialTab = 0,
  });
  final AppRepository repository;
  final ValueChanged<String> openProfile;
  final VoidCallback postOpportunity;
  final int initialTab;

  @override
  State<CollabsScreen> createState() => _CollabsScreenState();
}

class _CollabsScreenState extends State<CollabsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(
    length: 2,
    vsync: this,
    initialIndex: widget.initialTab == 1 ? 1 : 0,
  )..addListener(_tabChanged);
  String _opportunityKind = 'all';
  late Future<List<SocialPost>> _opportunities = _loadOpportunities();
  late Future<List<AppRepositoryRow>> _myApplications = _loadApplications();
  late Future<List<AppRepositoryRow>> _myListings = _loadListings();
  late Future<List<CreatorRecommendation>> _recommendations = widget.repository
      .loadRecommendedCreators();
  Timer? _refreshTimer;
  String? _error;

  Future<List<SocialPost>> _loadOpportunities() => widget.repository.loadFeed(
    collabs: true,
    opportunityKind: _opportunityKind,
  );

  @override
  void initState() {
    super.initState();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 45),
      (_) => _refresh(),
    );
  }

  Future<List<AppRepositoryRow>> _loadApplications() async =>
      (await widget.repository.loadMyInterests())
          .map((row) => AppRepositoryRow(row))
          .toList();
  Future<List<AppRepositoryRow>> _loadListings() async =>
      (await widget.repository.loadMyOpportunities())
          .map((row) => AppRepositoryRow(row))
          .toList();

  void _tabChanged() {
    if (!_tabs.indexIsChanging) return;
    setState(() => _error = null);
  }

  void _refresh() {
    if (!mounted) return;
    setState(() {
      _opportunities = _loadOpportunities();
      _myApplications = _loadApplications();
      _myListings = _loadListings();
      _recommendations = widget.repository.loadRecommendedCreators();
    });
  }

  void _setOpportunityKind(String? kind) {
    if (kind == null || kind == _opportunityKind) return;
    setState(() {
      _opportunityKind = kind;
      _error = null;
      _opportunities = _loadOpportunities();
    });
  }

  Future<void> _followCreator(Creator creator) async {
    try {
      await widget.repository.setFollowing(creator.id, true);
      if (mounted) _refresh();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not follow this creator.');
      }
    }
  }

  Future<void> _messageCreator(Creator creator) async {
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
      if (mounted) _refresh();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not start a conversation.');
      }
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _tabs.removeListener(_tabChanged);
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _respond(String id, String status) async {
    try {
      await widget.repository.respondToInterest(id, status);
      if (mounted) _refresh();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  Future<void> _status(String id, String status) async {
    try {
      await widget.repository.updateOpportunityStatus(id, status);
      if (mounted) _refresh();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Find your people',
                      style: TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w700,
                        height: 1.25,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Ideas, skills, and creators looking to build together.',
                      style: TextStyle(
                        color: Color(0xFFAAA49D),
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              FilledButton.icon(
                onPressed: widget.postOpportunity,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Post an opportunity'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF329CFF),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 11,
                  ),
                  textStyle: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  shape: const StadiumBorder(),
                ),
              ),
            ],
          ),
        ),
        TabBar(
          controller: _tabs,
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFFAAA49D),
          indicatorColor: const Color(0xFF329CFF),
          dividerColor: Colors.white.withValues(alpha: 0.09),
          labelStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
          tabs: const [
            Tab(text: 'Discover'),
            Tab(text: 'My opportunities'),
          ],
        ),
        if (_error != null)
          InlineNotice(
            text: _error!,
            isError: true,
            onClose: () => setState(() => _error = null),
          ),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              RefreshIndicator(
                onRefresh: () async => _refresh(),
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    _RecommendationsSection(
                      future: _recommendations,
                      repository: widget.repository,
                      openProfile: widget.openProfile,
                      followCreator: _followCreator,
                      messageCreator: _messageCreator,
                      onRefresh: _refresh,
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          DropdownButtonFormField<String>(
                            initialValue: _opportunityKind,
                            decoration: const InputDecoration(
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 12,
                              ),
                            ),
                            items: const [
                              DropdownMenuItem(
                                value: 'all',
                                child: Text('All opportunities'),
                              ),
                              DropdownMenuItem(
                                value: 'cofounder',
                                child: Text('Co-founder'),
                              ),
                              DropdownMenuItem(
                                value: 'collaborator',
                                child: Text('Creative collaborator'),
                              ),
                              DropdownMenuItem(
                                value: 'feedback',
                                child: Text('Feedback'),
                              ),
                              DropdownMenuItem(
                                value: 'client',
                                child: Text('Clients or customers'),
                              ),
                              DropdownMenuItem(
                                value: 'other',
                                child: Text('Something else'),
                              ),
                            ],
                            onChanged: _setOpportunityKind,
                          ),
                          const SizedBox(height: 9),
                          const Text(
                            'Looking for a specific skill or creator? Use Search in the bottom menu.',
                            style: TextStyle(
                              color: Color(0xFFAAA49D),
                              fontSize: 11,
                              height: 1.45,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Colors.redAccent),
                        ),
                      ),
                    _OpportunitySection(
                      future: _opportunities,
                      repository: widget.repository,
                      openProfile: widget.openProfile,
                      postOpportunity: widget.postOpportunity,
                      onRefresh: _refresh,
                    ),
                  ],
                ),
              ),
              DefaultTabController(
                length: 2,
                child: Column(
                  children: [
                    const TabBar(
                      isScrollable: true,
                      labelColor: Colors.white,
                      unselectedLabelColor: Color(0xFFAAA49D),
                      indicatorColor: Color(0xFF329CFF),
                      tabs: [
                        Tab(text: 'Your listings'),
                        Tab(text: 'Interests sent'),
                      ],
                    ),
                    Expanded(
                      child: TabBarView(
                        children: [
                          _ListingsList(
                            future: _myListings,
                            onRefresh: _refresh,
                            respond: _respond,
                            changeStatus: _status,
                            openProfile: widget.openProfile,
                            messageCreator: _messageCreator,
                          ),
                          _ApplicationsList(
                            future: _myApplications,
                            onRefresh: _refresh,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class AppRepositoryRow {
  AppRepositoryRow(this.value);
  final Map<String, dynamic> value;
}

class _RecommendationsSection extends StatelessWidget {
  const _RecommendationsSection({
    required this.future,
    required this.repository,
    required this.openProfile,
    required this.followCreator,
    required this.messageCreator,
    required this.onRefresh,
  });

  final Future<List<CreatorRecommendation>> future;
  final AppRepository repository;
  final ValueChanged<String> openProfile;
  final ValueChanged<Creator> followCreator;
  final ValueChanged<Creator> messageCreator;
  final VoidCallback onRefresh;

  @override
  Widget build(
    BuildContext context,
  ) => FutureBuilder<List<CreatorRecommendation>>(
    future: future,
    builder: (context, snapshot) {
      final recommendations = snapshot.data ?? [];
      return Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Colors.white.withValues(alpha: 0.09)),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.auto_awesome,
                            size: 16,
                            color: Color(0xFF329CFF),
                          ),
                          SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              'Creators matched for you',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 5),
                      Text(
                        'Based on skills and interests in your profile.',
                        style: TextStyle(
                          color: Color(0xFFAAA49D),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => openProfile(repository.userId),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF329CFF),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Tune matches',
                    style: TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (snapshot.connectionState == ConnectionState.waiting &&
                !snapshot.hasData)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 6),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            else if (snapshot.hasError)
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Creator matches could not be loaded.',
                      style: TextStyle(color: Color(0xFFFF9E9E), fontSize: 12),
                    ),
                  ),
                  TextButton(
                    onPressed: onRefresh,
                    child: const Text('Try again'),
                  ),
                ],
              )
            else if (recommendations.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.025),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.09),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'No close matches yet.',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      'Add more skills and interests to your profile, then check back as new creators join.',
                      style: TextStyle(
                        color: Color(0xFFAAA49D),
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                    TextButton(
                      onPressed: () => openProfile(repository.userId),
                      child: const Text('Edit your profile'),
                    ),
                  ],
                ),
              )
            else
              for (final recommendation in recommendations)
                Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.025),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.09),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          InkWell(
                            onTap: () => openProfile(recommendation.creator.id),
                            child: CreatorAvatar(
                              url: recommendation.creator.avatarUrl,
                              name: recommendation.creator.name,
                              radius: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: InkWell(
                              onTap: () =>
                                  openProfile(recommendation.creator.id),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    recommendation.creator.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    '${recommendation.creator.handle}${recommendation.creator.role.isEmpty ? '' : ' · ${recommendation.creator.role}'}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Color(0xFFAAA49D),
                                      fontSize: 12,
                                    ),
                                  ),
                                  if (recommendation
                                      .creator
                                      .bio
                                      .isNotEmpty) ...[
                                    const SizedBox(height: 5),
                                    Text(
                                      recommendation.creator.bio,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Color(0xFFD0CBC5),
                                        fontSize: 12,
                                        height: 1.5,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: recommendation.reasons
                            .map((reason) => _ReasonChip(label: reason))
                            .toList(),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          OutlinedButton(
                            onPressed: () =>
                                openProfile(recommendation.creator.id),
                            child: const Text('View profile'),
                          ),
                          OutlinedButton(
                            onPressed: () =>
                                messageCreator(recommendation.creator),
                            child: const Text('Message'),
                          ),
                          FilledButton(
                            onPressed: () =>
                                followCreator(recommendation.creator),
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF329CFF),
                            ),
                            child: const Text('Follow'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
          ],
        ),
      );
    },
  );
}

class _OpportunitySection extends StatelessWidget {
  const _OpportunitySection({
    required this.future,
    required this.repository,
    required this.openProfile,
    required this.postOpportunity,
    required this.onRefresh,
  });

  final Future<List<SocialPost>> future;
  final AppRepository repository;
  final ValueChanged<String> openProfile;
  final VoidCallback postOpportunity;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => FutureBuilder<List<SocialPost>>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.waiting &&
          !snapshot.hasData) {
        return const Padding(
          padding: EdgeInsets.symmetric(vertical: 42),
          child: Center(child: CircularProgressIndicator()),
        );
      }
      if (snapshot.hasError) {
        return const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Text(
            'Could not load opportunities.',
            style: TextStyle(color: Colors.redAccent),
          ),
        );
      }
      final posts = snapshot.data ?? [];
      if (posts.isEmpty) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 42, 24, 56),
          child: Column(
            children: [
              const Text(
                'No open calls yet',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 7),
              const Text(
                'Be the first to say what you’re looking for and meet your next collaborator.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFFAAA49D),
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: postOpportunity,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF329CFF),
                ),
                child: const Text('Post what you need'),
              ),
            ],
          ),
        );
      }
      return Column(
        children: [
          for (final post in posts)
            PostCard(
              key: ValueKey(post.id),
              post: post,
              repository: repository,
              openProfile: openProfile,
              onDeleted: onRefresh,
            ),
        ],
      );
    },
  );
}

class _ReasonChip extends StatelessWidget {
  const _ReasonChip({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
    decoration: BoxDecoration(
      color: const Color(0xFF329CFF).withValues(alpha: 0.08),
      border: Border.all(
        color: const Color(0xFF329CFF).withValues(alpha: 0.25),
      ),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      label,
      style: const TextStyle(
        color: Color(0xFFB9D6FF),
        fontSize: 10,
        height: 1.4,
      ),
    ),
  );
}

class _ApplicationsList extends StatelessWidget {
  const _ApplicationsList({required this.future, required this.onRefresh});
  final Future<List<AppRepositoryRow>> future;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) => FutureBuilder<List<AppRepositoryRow>>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.waiting &&
          !snapshot.hasData) {
        return const LoadingPanel(label: 'Loading your interests…');
      }
      if (snapshot.hasError) {
        return _TryAgain(
          onPressed: onRefresh,
          text: 'Could not load your interests.',
        );
      }
      final rows = snapshot.data ?? [];
      if (rows.isEmpty) {
        return const Center(
          child: Text('Your sent interests will appear here.'),
        );
      }
      return RefreshIndicator(
        onRefresh: () async => onRefresh(),
        child: ListView(
          padding: const EdgeInsets.all(14),
          children: rows.map((entry) {
            final row = entry.value;
            final opportunity = rowValue(row['opportunity']);
            return Card(
              child: ListTile(
                title: Text(
                  stringValue(opportunity['opportunity_title'], 'Opportunity'),
                ),
                subtitle: Text(
                  '${stringValue(opportunity['opportunity_role'])}\n${stringValue(row['introduction'])}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                isThreeLine: true,
                trailing: _Status(stringValue(row['status'], 'pending')),
              ),
            );
          }).toList(),
        ),
      );
    },
  );
}

class _ListingsList extends StatelessWidget {
  const _ListingsList({
    required this.future,
    required this.onRefresh,
    required this.respond,
    required this.changeStatus,
    required this.openProfile,
    required this.messageCreator,
  });
  final Future<List<AppRepositoryRow>> future;
  final VoidCallback onRefresh;
  final Future<void> Function(String, String) respond;
  final Future<void> Function(String, String) changeStatus;
  final ValueChanged<String> openProfile;
  final ValueChanged<Creator> messageCreator;

  @override
  Widget build(BuildContext context) => FutureBuilder<List<AppRepositoryRow>>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.connectionState == ConnectionState.waiting &&
          !snapshot.hasData) {
        return const LoadingPanel(label: 'Loading your listings…');
      }
      if (snapshot.hasError) {
        return _TryAgain(
          onPressed: onRefresh,
          text: 'Could not load your listings.',
        );
      }
      final rows = snapshot.data ?? [];
      if (rows.isEmpty) {
        return const Center(
          child: Text('Opportunities you publish will appear here.'),
        );
      }
      return RefreshIndicator(
        onRefresh: () async => onRefresh(),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: rows.map((entry) {
            final row = entry.value;
            final interests = (row['interests'] as List? ?? [])
                .map((e) => rowValue(e))
                .toList();
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            stringValue(
                              row['opportunity_title'],
                              'Opportunity',
                            ),
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ),
                        PopupMenuButton<String>(
                          onSelected: (status) =>
                              changeStatus(stringValue(row['id']), status),
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'open', child: Text('Open')),
                            PopupMenuItem(
                              value: 'paused',
                              child: Text('Pause'),
                            ),
                            PopupMenuItem(
                              value: 'filled',
                              child: Text('Filled'),
                            ),
                          ],
                          child: _Status(
                            stringValue(row['opportunity_status'], 'open'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${interests.length} interest${interests.length == 1 ? '' : 's'}',
                    ),
                    for (final interest in interests)
                      Container(
                        margin: const EdgeInsets.only(top: 10),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.035),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Builder(
                              builder: (context) {
                                final applicant = rowValue(
                                  interest['applicant'],
                                );
                                final creator = Creator.fromRow({
                                  ...applicant,
                                  'id': interest['applicant_id'],
                                });
                                return Row(
                                  children: [
                                    CreatorAvatar(
                                      url: creator.avatarUrl,
                                      name: creator.name,
                                      radius: 18,
                                    ),
                                    const SizedBox(width: 9),
                                    Expanded(
                                      child: InkWell(
                                        onTap: () => openProfile(creator.id),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              creator.name,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            if (creator.handle.isNotEmpty)
                                              Text(
                                                '${creator.handle}${creator.role.isEmpty ? '' : ' · ${creator.role}'}',
                                                style: const TextStyle(
                                                  color: Color(0xFFAAA49D),
                                                  fontSize: 11,
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                );
                              },
                            ),
                            const SizedBox(height: 5),
                            Text(stringValue(interest['introduction'])),
                            const SizedBox(height: 8),
                            if (stringValue(interest['status']) == 'pending')
                              Wrap(
                                spacing: 8,
                                children: [
                                  OutlinedButton(
                                    onPressed: () => respond(
                                      stringValue(interest['id']),
                                      'declined',
                                    ),
                                    child: const Text('Decline'),
                                  ),
                                  FilledButton(
                                    onPressed: () => respond(
                                      stringValue(interest['id']),
                                      'accepted',
                                    ),
                                    child: const Text('Accept & connect'),
                                  ),
                                ],
                              )
                            else if (stringValue(interest['status']) ==
                                'accepted')
                              OutlinedButton.icon(
                                onPressed: () {
                                  final applicant = rowValue(
                                    interest['applicant'],
                                  );
                                  messageCreator(
                                    Creator.fromRow({
                                      ...applicant,
                                      'id': interest['applicant_id'],
                                    }),
                                  );
                                },
                                icon: const Icon(
                                  Icons.chat_bubble_outline,
                                  size: 16,
                                ),
                                label: const Text('Message creator'),
                              )
                            else
                              _Status(stringValue(interest['status'])),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      );
    },
  );
}

class _Status extends StatelessWidget {
  const _Status(this.value);
  final String value;

  @override
  Widget build(BuildContext context) => Chip(
    label: Text(value, style: const TextStyle(fontSize: 11)),
    visualDensity: VisualDensity.compact,
    side: BorderSide.none,
    backgroundColor: Colors.blue.withValues(alpha: 0.13),
  );
}

class _TryAgain extends StatelessWidget {
  const _TryAgain({required this.onPressed, required this.text});
  final VoidCallback onPressed;
  final String text;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(text),
        const SizedBox(height: 8),
        OutlinedButton(onPressed: onPressed, child: const Text('Try again')),
      ],
    ),
  );
}
