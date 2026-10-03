import 'package:flutter/material.dart';

import 'models.dart';

class CreatorAvatar extends StatelessWidget {
  const CreatorAvatar({super.key, this.url, this.name = '', this.radius = 20});
  final String? url;
  final String name;
  final double radius;

  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: radius,
    backgroundColor: Colors.white.withValues(alpha: 0.08),
    foregroundImage: url == null || url!.isEmpty ? null : NetworkImage(url!),
    child: Text(
      name.trim().isEmpty ? 'B' : name.trim().substring(0, 1).toUpperCase(),
      style: TextStyle(
        fontSize: radius * 0.8,
        fontWeight: FontWeight.w700,
        color: Colors.white70,
      ),
    ),
  );
}

class InlineNotice extends StatelessWidget {
  const InlineNotice({
    super.key,
    required this.text,
    this.isError = false,
    this.onClose,
  });
  final String text;
  final bool isError;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.all(12),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: (isError ? Colors.redAccent : Colors.greenAccent).withValues(
        alpha: 0.1,
      ),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(
        color: (isError ? Colors.redAccent : Colors.greenAccent).withValues(
          alpha: 0.18,
        ),
      ),
    ),
    child: Row(
      children: [
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              color: isError ? Colors.redAccent : Colors.greenAccent,
            ),
          ),
        ),
        if (onClose != null)
          IconButton(
            onPressed: onClose,
            icon: const Icon(Icons.close, size: 18),
            visualDensity: VisualDensity.compact,
          ),
      ],
    ),
  );
}

class PageFrame extends StatelessWidget {
  const PageFrame({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.sizeOf(context).width < 640 ? 420.0 : 598.0;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

class LoadingPanel extends StatelessWidget {
  const LoadingPanel({super.key, this.label = 'Loading…'});
  final String label;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(
            label,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.62)),
          ),
        ],
      ),
    ),
  );
}

String relativeTime(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return '';
  final delta = DateTime.now().difference(date);
  if (delta.inSeconds < 60) return 'now';
  if (delta.inMinutes < 60) return '${delta.inMinutes}m';
  if (delta.inHours < 24) return '${delta.inHours}h';
  if (delta.inDays < 7) return '${delta.inDays}d';
  return '${date.day}/${date.month}/${date.year}';
}

String initials(Creator creator) =>
    creator.name.isEmpty ? 'B' : creator.name.substring(0, 1).toUpperCase();
