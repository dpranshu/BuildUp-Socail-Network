import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/repository.dart';
import '../models.dart';
import '../widgets.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.repository,
    required this.conversationId,
    required this.participant,
  });
  final AppRepository repository;
  final String conversationId;
  final Creator participant;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  bool _sending = false;
  String? _error;
  String? _lastMessageId;
  final List<Map<String, dynamic>> _sentMessages = [];
  late final Stream<List<Map<String, dynamic>>> _messages = Supabase
      .instance
      .client
      .from('messages')
      .stream(primaryKey: ['id'])
      .eq('conversation_id', widget.conversationId)
      .order('created_at');

  @override
  void initState() {
    super.initState();
    unawaited(_markRead());
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final body = _controller.text;
    if (_sending || body.trim().isEmpty) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final message = await widget.repository.sendMessage(
        widget.conversationId,
        body,
      );
      if (!mounted) return;
      setState(() {
        _sentMessages.removeWhere(
          (sent) => stringValue(sent['id']) == stringValue(message['id']),
        );
        _sentMessages.add(message);
      });
      _controller.clear();
      _scrollToBottom();
      await _markRead();
    } on FormatException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Message could not be sent. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _markRead() async {
    try {
      await widget.repository.markConversationRead(widget.conversationId);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Messages loaded, but their read status could not be updated.',
        );
      }
    }
  }

  void _maybeRead(List<Map<String, dynamic>> messages) {
    if (messages.isEmpty) return;
    final newest = messages.first;
    final id = stringValue(newest['id']);
    if (id != _lastMessageId) {
      _lastMessageId = id;
      if (newest['sender_id'] != widget.repository.userId) {
        unawaited(_markRead());
      }
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.minScrollExtent,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Row(
        children: [
          CreatorAvatar(
            url: widget.participant.avatarUrl,
            name: widget.participant.name,
            radius: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              widget.participant.name,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    ),
    body: Column(
      children: [
        if (_error != null) InlineNotice(text: _error!, isError: true),
        Expanded(
          child: StreamBuilder<List<Map<String, dynamic>>>(
            stream: _messages,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const Center(
                  child: Text('Messages could not be loaded.'),
                );
              }
              if (!snapshot.hasData) {
                return const LoadingPanel(label: 'Loading messages…');
              }
              final messagesById = {
                for (final message in snapshot.data!)
                  stringValue(message['id']): message,
              };
              for (final message in _sentMessages) {
                messagesById.putIfAbsent(
                  stringValue(message['id']),
                  () => message,
                );
              }
              final messages = messagesById.values.toList()
                ..sort((first, second) {
                  final timestampOrder = stringValue(
                    second['created_at'],
                  ).compareTo(stringValue(first['created_at']));
                  if (timestampOrder != 0) return timestampOrder;
                  return stringValue(
                    second['id'],
                  ).compareTo(stringValue(first['id']));
                });
              _maybeRead(messages);
              if (messages.isEmpty) {
                return const Center(
                  child: Text('Say hello to start your conversation.'),
                );
              }
              final uid = widget.repository.userId;
              return ListView.builder(
                controller: _scrollController,
                reverse: true,
                padding: const EdgeInsets.all(16),
                itemCount: messages.length,
                itemBuilder: (context, index) {
                  final message = messages[index];
                  final mine = message['sender_id'] == uid;
                  return Align(
                    alignment: mine
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Container(
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                      ),
                      margin: const EdgeInsets.only(bottom: 9),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: mine
                            ? const Color(0xFF185A91)
                            : Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            stringValue(message['body']),
                            style: const TextStyle(height: 1.4),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            relativeTime(stringValue(message['created_at'])),
                            style: const TextStyle(
                              fontSize: 10,
                              color: Colors.white60,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    minLines: 1,
                    maxLines: 5,
                    maxLength: 4000,
                    decoration: const InputDecoration(
                      hintText: 'Write a message…',
                      counterText: '',
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
