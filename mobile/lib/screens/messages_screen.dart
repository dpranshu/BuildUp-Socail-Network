import 'dart:async';

import 'package:flutter/material.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';
import 'chat_screen.dart';
import 'search_screen.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key, required this.repository});
  final AppRepository repository;

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  late Future<List<SocialConversation>> _future = widget.repository
      .loadConversations();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {
        _future = widget.repository.loadConversations();
      });
    }
  }

  Future<void> _open(SocialConversation conversation) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ChatScreen(
          repository: widget.repository,
          conversationId: conversation.id,
          participant: conversation.participant,
        ),
      ),
    );
    _refresh();
  }

  void _newMessage() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SearchScreen(repository: widget.repository),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => PageFrame(
    child: FutureBuilder<List<SocialConversation>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const LoadingPanel(label: 'Loading messages…');
        }
        if (snapshot.hasError) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Messages could not be loaded.'),
                TextButton(onPressed: _refresh, child: const Text('Try again')),
              ],
            ),
          );
        }
        final conversations = snapshot.data ?? [];
        return Column(
          children: [
            if (conversations.isEmpty)
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.chat_bubble_outline,
                        size: 40,
                        color: Colors.white38,
                      ),
                      const SizedBox(height: 10),
                      const Text('Your conversations will appear here.'),
                      const SizedBox(height: 8),
                      FilledButton.tonalIcon(
                        onPressed: _newMessage,
                        icon: const Icon(Icons.add),
                        label: const Text('Find someone to message'),
                      ),
                    ],
                  ),
                ),
              )
            else
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => _refresh(),
                  child: ListView.separated(
                    itemCount: conversations.length,
                    separatorBuilder: (_, _) =>
                        const Divider(height: 1, indent: 72),
                    itemBuilder: (context, index) {
                      final conversation = conversations[index];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 5,
                        ),
                        leading: Stack(
                          children: [
                            CreatorAvatar(
                              url: conversation.participant.avatarUrl,
                              name: conversation.participant.name,
                              radius: 25,
                            ),
                            if (conversation.unread)
                              const Positioned(
                                right: 0,
                                top: 0,
                                child: CircleAvatar(
                                  radius: 5,
                                  backgroundColor: Color(0xFF329CFF),
                                ),
                              ),
                          ],
                        ),
                        title: Text(
                          conversation.participant.name,
                          style: TextStyle(
                            fontWeight: conversation.unread
                                ? FontWeight.w800
                                : FontWeight.w600,
                          ),
                        ),
                        subtitle: Text(
                          conversation.preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: Text(
                          relativeTime(conversation.updatedAt),
                          style: const TextStyle(
                            color: Colors.white54,
                            fontSize: 11,
                          ),
                        ),
                        onTap: () => _open(conversation),
                      );
                    },
                  ),
                ),
              ),
          ],
        );
      },
    ),
  );
}
