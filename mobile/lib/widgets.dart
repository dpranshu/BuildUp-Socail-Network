import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import 'models.dart';

class CreatorAvatar extends StatelessWidget {
  const CreatorAvatar({super.key, this.url, this.name = '', this.radius = 20});
  final String? url;
  final String name;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final diameter = radius * 2;
    Widget fallback() => Center(
      child: LucideIcon(
        LucideIconType.userRound,
        size: radius < 18 ? 20 : radius,
        color: const Color(0xFFC5BFB7),
        strokeWidth: 1.7,
      ),
    );

    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.06),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      clipBehavior: Clip.antiAlias,
      child: url == null || url!.isEmpty
          ? fallback()
          : Image.network(
              url!,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => fallback(),
              loadingBuilder: (context, child, progress) =>
                  progress == null ? child : fallback(),
            ),
    );
  }
}

enum LucideIconType {
  search,
  bell,
  messageCircle,
  house,
  handshake,
  plus,
  userRound,
  repeat2,
}

class LucideIcon extends StatelessWidget {
  const LucideIcon(
    this.type, {
    super.key,
    this.size = 24,
    this.color,
    this.strokeWidth = 1.8,
  });

  final LucideIconType type;
  final double size;
  final Color? color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) => CustomPaint(
    size: Size.square(size),
    painter: _LucideIconPainter(
      type,
      color ?? IconTheme.of(context).color ?? Colors.white,
      strokeWidth,
    ),
  );
}

class _LucideIconPainter extends CustomPainter {
  const _LucideIconPainter(this.type, this.color, this.strokeWidth);

  final LucideIconType type;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    switch (type) {
      case LucideIconType.search:
        canvas.drawCircle(const Offset(11, 11), 8, paint);
        canvas.drawLine(
          const Offset(21, 21),
          const Offset(16.65, 16.65),
          paint,
        );
      case LucideIconType.bell:
        final bell = Path()
          ..moveTo(3.262, 15.326)
          ..cubicTo(3.05, 15.54, 3.12, 16.34, 3.5, 16.72)
          ..cubicTo(3.64, 16.9, 3.81, 17, 4, 17)
          ..lineTo(20, 17)
          ..cubicTo(20.19, 17, 21, 17, 20.74, 16.327)
          ..cubicTo(19.41, 13.956, 18, 12.499, 18, 8)
          ..cubicTo(18, 4.686, 15.314, 2, 12, 2)
          ..cubicTo(8.686, 2, 6, 4.686, 6, 8)
          ..cubicTo(6, 12.499, 4.59, 13.956, 3.262, 15.326)
          ..close();
        canvas.drawPath(bell, paint);
        final clapper = Path()
          ..moveTo(10.268, 21)
          ..cubicTo(11.268, 23, 12.732, 23, 13.732, 21);
        canvas.drawPath(clapper, paint);
      case LucideIconType.messageCircle:
        final message = Path()
          ..moveTo(2.992, 16.342)
          ..arcTo(
            Rect.fromCircle(center: const Offset(12, 12), radius: 10),
            2.692,
            4.315,
            false,
          )
          ..cubicTo(7.42, 20.94, 7.04, 20.91, 6.69, 21.02)
          ..lineTo(3.28, 22.02)
          ..cubicTo(2.63, 22.23, 2.02, 21.62, 2.23, 20.97)
          ..lineTo(3.29, 17.68)
          ..cubicTo(3.38, 17.27, 3.34, 16.87, 2.992, 16.342)
          ..close();
        canvas.drawPath(message, paint);
      case LucideIconType.house:
        final doorway = Path()
          ..moveTo(15, 21)
          ..lineTo(15, 14)
          ..cubicTo(15, 13.45, 14.55, 13, 14, 13)
          ..lineTo(10, 13)
          ..cubicTo(9.45, 13, 9, 13.45, 9, 14)
          ..lineTo(9, 21);
        final house = Path()
          ..moveTo(3, 10)
          ..cubicTo(3, 9.4, 3.27, 8.83, 3.709, 8.472)
          ..lineTo(10.709, 2.472)
          ..cubicTo(11.455, 1.833, 12.545, 1.833, 13.291, 2.472)
          ..lineTo(20.291, 8.472)
          ..cubicTo(20.73, 8.83, 21, 9.4, 21, 10)
          ..lineTo(21, 19)
          ..cubicTo(21, 20.1, 20.1, 21, 19, 21)
          ..lineTo(5, 21)
          ..cubicTo(3.9, 21, 3, 20.1, 3, 19)
          ..close();
        canvas
          ..drawPath(doorway, paint)
          ..drawPath(house, paint);
      case LucideIconType.handshake:
        final firstHand = Path()
          ..moveTo(11, 17)
          ..lineTo(13, 19)
          ..cubicTo(14.5, 20.5, 17.5, 17.5, 16, 16);
        final joiningHands = Path()
          ..moveTo(14, 14)
          ..lineTo(16.5, 16.5)
          ..cubicTo(18, 18, 21, 15, 19.5, 13.5)
          ..lineTo(15.62, 9.62)
          ..cubicTo(14.45, 8.45, 12.55, 8.45, 11.38, 9.62)
          ..lineTo(10.5, 10.5)
          ..cubicTo(9, 12, 6, 9, 7.5, 7.5)
          ..lineTo(10.31, 4.69)
          ..cubicTo(12, 3, 15, 2.5, 17.37, 3.82)
          ..lineTo(17.84, 4.1)
          ..cubicTo(18.27, 4.36, 18.78, 4.45, 19.27, 4.35)
          ..lineTo(21, 4);
        final rightArm = Path()
          ..moveTo(21, 3)
          ..lineTo(22, 14)
          ..lineTo(20, 14);
        final leftArm = Path()
          ..moveTo(3, 3)
          ..lineTo(2, 14)
          ..lineTo(8.5, 20.5)
          ..cubicTo(10, 22, 13, 19, 11.5, 17.5);
        final leftTop = Path()
          ..moveTo(3, 4)
          ..lineTo(11, 4);
        canvas
          ..drawPath(firstHand, paint)
          ..drawPath(joiningHands, paint)
          ..drawPath(rightArm, paint)
          ..drawPath(leftArm, paint)
          ..drawPath(leftTop, paint);
      case LucideIconType.plus:
        canvas
          ..drawLine(const Offset(5, 12), const Offset(19, 12), paint)
          ..drawLine(const Offset(12, 5), const Offset(12, 19), paint);
      case LucideIconType.userRound:
        final user = Path()
          ..moveTo(20, 21)
          ..cubicTo(20, 16.582, 16.418, 13, 12, 13)
          ..cubicTo(7.582, 13, 4, 16.582, 4, 21);
        canvas.drawPath(user, paint);
        canvas.drawCircle(const Offset(12, 8), 5, paint);
      case LucideIconType.repeat2:
        final firstArrow = Path()
          ..moveTo(2, 9)
          ..lineTo(5, 6)
          ..lineTo(8, 9);
        final firstTrack = Path()
          ..moveTo(13, 18)
          ..lineTo(7, 18)
          ..cubicTo(5.9, 18, 5, 17.1, 5, 16)
          ..lineTo(5, 6);
        final secondArrow = Path()
          ..moveTo(22, 15)
          ..lineTo(19, 18)
          ..lineTo(16, 15);
        final secondTrack = Path()
          ..moveTo(11, 6)
          ..lineTo(17, 6)
          ..cubicTo(18.1, 6, 19, 6.9, 19, 8)
          ..lineTo(19, 18);
        canvas
          ..drawPath(firstArrow, paint)
          ..drawPath(firstTrack, paint)
          ..drawPath(secondArrow, paint)
          ..drawPath(secondTrack, paint);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LucideIconPainter oldDelegate) =>
      type != oldDelegate.type ||
      color != oldDelegate.color ||
      strokeWidth != oldDelegate.strokeWidth;
}

class LucideHeart extends StatelessWidget {
  const LucideHeart({
    super.key,
    this.size = 76,
    this.color = const Color(0xFFF43F5E),
  });

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(size), painter: _LucideHeartPainter(color));
}

class _LucideHeartPainter extends CustomPainter {
  const _LucideHeartPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    final heart = Path()
      ..moveTo(20.84, 4.61)
      ..arcToPoint(
        const Offset(13.06, 4.61),
        radius: const Radius.circular(5.5),
        clockwise: false,
      )
      ..lineTo(12, 5.67)
      ..lineTo(10.94, 4.61)
      ..arcToPoint(
        const Offset(3.16, 12.39),
        radius: const Radius.circular(5.5),
        clockwise: false,
      )
      ..lineTo(4.22, 13.45)
      ..lineTo(12, 21.23)
      ..lineTo(19.78, 13.45)
      ..lineTo(20.84, 12.39)
      ..arcToPoint(
        const Offset(20.84, 4.61),
        radius: const Radius.circular(5.5),
        clockwise: false,
      )
      ..close();

    canvas.save();
    canvas.translate(0, 0.6);
    canvas.drawPath(
      heart,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.65)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4)
        ..style = PaintingStyle.fill,
    );
    canvas.restore();
    canvas.drawPath(
      heart,
      Paint()
        ..color = color
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      heart,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _LucideHeartPainter oldDelegate) =>
      color != oldDelegate.color;
}

class InlineVideo extends StatefulWidget {
  const InlineVideo({super.key, required this.url});

  final String url;

  @override
  State<InlineVideo> createState() => _InlineVideoState();
}

class _InlineVideoState extends State<InlineVideo> {
  late final VideoPlayerController _controller =
      VideoPlayerController.networkUrl(Uri.parse(widget.url));
  late final Future<void> _initialization = _controller.initialize();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _togglePlayback() async {
    if (_controller.value.isPlaying) {
      await _controller.pause();
    } else {
      await _controller.play();
    }
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<void>(
    future: _initialization,
    builder: (context, snapshot) {
      if (snapshot.hasError) {
        return Container(
          height: 180,
          alignment: Alignment.center,
          color: Colors.black,
          child: const Text(
            'Video could not be loaded.',
            style: TextStyle(color: Colors.white70),
          ),
        );
      }
      if (snapshot.connectionState != ConnectionState.done) {
        return const SizedBox(
          height: 180,
          child: Center(child: CircularProgressIndicator()),
        );
      }
      return LayoutBuilder(
        builder: (context, constraints) {
          final aspectRatio = _controller.value.aspectRatio;
          final height = (constraints.maxWidth / aspectRatio).clamp(1.0, 520.0);
          return SizedBox(
            height: height,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox.expand(child: VideoPlayer(_controller)),
                IconButton.filledTonal(
                  tooltip: _controller.value.isPlaying
                      ? 'Pause video'
                      : 'Play video',
                  onPressed: _togglePlayback,
                  icon: Icon(
                    _controller.value.isPlaying
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                  ),
                ),
                Positioned(
                  left: 8,
                  right: 8,
                  bottom: 4,
                  child: VideoProgressIndicator(
                    _controller,
                    allowScrubbing: true,
                    colors: const VideoProgressColors(
                      playedColor: Color(0xFF329CFF),
                      bufferedColor: Colors.white54,
                      backgroundColor: Colors.white24,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      );
    },
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
  const PageFrame({
    super.key,
    required this.child,
    this.horizontalBleed = 0,
  });
  final Widget child;
  final double horizontalBleed;

  @override
  Widget build(BuildContext context) {
    final maxWidth =
        (MediaQuery.sizeOf(context).width < 640 ? 420.0 : 598.0) +
        horizontalBleed;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

class AppNavigation {
  AppNavigation._();

  static final ValueNotifier<int?> tabRequest = ValueNotifier(null);
  static int activeTab = 0;
  static int unreadMessages = 0;

  static void navigateToTab(int index) {
    tabRequest.value = index;
  }
}

class AppBottomNavigationBar extends StatelessWidget {
  const AppBottomNavigationBar({
    super.key,
    required this.selectedIndex,
    required this.unreadMessages,
    required this.onTap,
  });

  final int selectedIndex;
  final int unreadMessages;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    const items = [
      (label: 'Home', icon: LucideIconType.house),
      (label: 'Collabs', icon: LucideIconType.handshake),
      (label: 'Create', icon: LucideIconType.plus),
      (label: 'Messages', icon: LucideIconType.messageCircle),
    ];
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return Container(
      height: 68 + bottomInset,
      padding: EdgeInsets.only(bottom: bottomInset),
      decoration: BoxDecoration(
        color: const Color(0xFF0D0F11),
        border: Border(
          top: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
      child: Row(
        children: [
          for (var index = 0; index < items.length; index++)
            Expanded(
              child: AppNavigationItem(
                label: items[index].label,
                icon: items[index].icon,
                selected: selectedIndex == index,
                badge: index == 3 ? unreadMessages : 0,
                showLabel: true,
                rail: false,
                onTap: () => onTap(index),
              ),
            ),
        ],
      ),
    );
  }
}

class AppNavigationRail extends StatelessWidget {
  const AppNavigationRail({
    super.key,
    required this.selectedIndex,
    required this.unreadMessages,
    required this.onTap,
  });

  final int selectedIndex;
  final int unreadMessages;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    const items = [
      (label: 'Home', icon: LucideIconType.house),
      (label: 'Collabs', icon: LucideIconType.handshake),
      (label: 'Create', icon: LucideIconType.plus),
      (label: 'Messages', icon: LucideIconType.messageCircle),
    ];
    return Container(
      width: 64,
      height: double.infinity,
      padding: const EdgeInsets.fromLTRB(8, 16, 8, 8),
      decoration: BoxDecoration(
        color: const Color(0xFF0D0F11),
        border: Border(
          right: BorderSide(color: Colors.white.withValues(alpha: 0.09)),
        ),
      ),
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0) const SizedBox(height: 16),
            AppNavigationItem(
              label: items[index].label,
              icon: items[index].icon,
              selected: selectedIndex == index,
              badge: index == 3 ? unreadMessages : 0,
              showLabel: false,
              rail: true,
              onTap: () => onTap(index),
            ),
          ],
        ],
      ),
    );
  }
}

class AppNavigationItem extends StatelessWidget {
  const AppNavigationItem({
    super.key,
    required this.label,
    required this.icon,
    required this.selected,
    required this.badge,
    required this.showLabel,
    required this.rail,
    required this.onTap,
  });

  final String label;
  final LucideIconType icon;
  final bool selected;
  final int badge;
  final bool showLabel;
  final bool rail;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final iconColor = selected ? Colors.white : const Color(0xFFC5BFB7);
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: rail ? 48 : null,
          height: rail ? 48 : 68,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Badge(
                isLabelVisible: badge > 0,
                label: Text(badge > 9 ? '9+' : '$badge'),
                child: SizedBox(
                  width: 48,
                  height: rail ? 48 : 32,
                  child: Center(
                    child: LucideIcon(
                      icon,
                      size: 24,
                      color: iconColor,
                      strokeWidth: 1.8,
                    ),
                  ),
                ),
              ),
              if (showLabel) ...[
                const SizedBox(height: 3),
                Text(
                  label,
                  style: TextStyle(
                    color: selected ? Colors.white : const Color(0xFFC5BFB7),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    height: 1.2,
                  ),
                ),
              ],
            ],
          ),
        ),
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
