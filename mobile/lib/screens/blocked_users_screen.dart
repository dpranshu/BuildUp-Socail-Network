import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';

class BlockedUsersScreen extends StatefulWidget {
  const BlockedUsersScreen({super.key, required this.repository});
  final AppRepository repository;

  @override
  State<BlockedUsersScreen> createState() => _BlockedUsersScreenState();
}

class _BlockedUsersScreenState extends State<BlockedUsersScreen> {
  late Future<List<JsonMap>> _future = widget.repository.loadBlockedUsers();
  String? _error;

  void _refresh() {
    setState(() {
      _future = widget.repository.loadBlockedUsers();
    });
  }

  Future<void> _unblock(String id) async {
    try {
      await widget.repository.unblockUser(id);
      _refresh();
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not unblock this account.');
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Blocked users')),
    body: PageFrame(
      child: FutureBuilder<List<JsonMap>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingPanel(label: 'Loading blocked users…');
          }
          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Unable to load blocked users.'),
                  TextButton(
                    onPressed: _refresh,
                    child: const Text('Try again'),
                  ),
                ],
              ),
            );
          }
          final users = snapshot.data ?? [];
          return Column(
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Posts from blocked accounts are hidden from your feed.',
                ),
              ),
              if (_error != null) InlineNotice(text: _error!, isError: true),
              Expanded(
                child: users.isEmpty
                    ? const Center(child: Text('No blocked users.'))
                    : RefreshIndicator(
                        onRefresh: () async => _refresh(),
                        child: ListView.separated(
                          itemCount: users.length,
                          separatorBuilder: (_, _) =>
                              const Divider(height: 1, indent: 70),
                          itemBuilder: (context, index) {
                            final user = users[index];
                            final id = stringValue(user['id']);
                            final name = stringValue(
                              user['display_name'],
                              'Creator',
                            );
                            return ListTile(
                              leading: CreatorAvatar(
                                url: user['avatar_url'] as String?,
                                name: name,
                                radius: 22,
                              ),
                              title: Text(name),
                              subtitle: Text(
                                stringValue(user['handle'], '@creator'),
                              ),
                              trailing: OutlinedButton(
                                onPressed: () => _unblock(id),
                                child: const Text('Unblock'),
                              ),
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    ),
  );
}
