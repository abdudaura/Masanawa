import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

/// Brand mark per BRAND-KIT §1: rounded gradient tile + white chat bubble
/// (tail bottom-left) holding a gradient map pin — "community conversation
/// anchored to a place". Painted, so it scales crisply at any size and can be
/// mirrored 1:1 into the launcher/splash bitmap assets.
class UnigeriaMark extends StatelessWidget {
  const UnigeriaMark({
    super.key,
    this.size = 72,
    this.dark = false,
  });

  /// Edge length of the square mark.
  final double size;

  /// Light-on-brand variant for gradient surfaces (splash): the tile flips to
  /// white so the mark reads against the brand gradient background.
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Semantics(
      label: 'Masanawa',
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * 0.22),
          boxShadow: [
            BoxShadow(
              color: u.brand.withValues(alpha: 0.25),
              blurRadius: size * 0.18,
              offset: Offset(0, size * 0.06),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.asset(
          'assets/brand/icon.png',
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (errorContext, error, stackTrace) {
            final fallback = errorContext.unigeria;
            return Container(
              color: fallback.brand,
              child: Center(
                child: Icon(Icons.location_city, color: Colors.white, size: size * 0.6),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Paints the mark. All proportions are relative to the edge length so the
/// glyph scales linearly with [UnigeriaMark.size].
class UnigeriaMarkPainter extends CustomPainter {
  UnigeriaMarkPainter({required this.tile, required this.pin});

  final Gradient tile;
  final Gradient pin;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final tileRect = Offset.zero & size;

    // Rounded tile.
    final tilePath = Path()
      ..addRRect(RRect.fromRectAndRadius(tileRect, Radius.circular(s * 0.24)));
    canvas.drawPath(tilePath, Paint()..shader = tile.createShader(tileRect));

    // White chat bubble with a bottom-left tail.
    final bubbleRect = Rect.fromLTRB(s * 0.14, s * 0.13, s * 0.86, s * 0.74);
    final bubblePath = Path()
      ..addRRect(
        RRect.fromRectAndRadius(bubbleRect, Radius.circular(s * 0.16)),
      );
    // Tail pointing down-left (sender of the "conversation").
    bubblePath
      ..moveTo(s * 0.30, s * 0.70)
      ..lineTo(s * 0.16, s * 0.96)
      ..lineTo(s * 0.54, s * 0.74)
      ..close();
    canvas.drawPath(bubblePath, Paint()..color = Colors.white);

    // Map pin inside the bubble: head circle + downward point.
    final pinHeadCenter = Offset(s * 0.50, s * 0.40);
    final pinHeadRadius = s * 0.15;
    final pinPath = Path()
      ..addOval(
        Rect.fromCircle(center: pinHeadCenter, radius: pinHeadRadius),
      );
    // Pin point overlapping the head's lower edge.
    pinPath
      ..moveTo(s * 0.36, s * 0.48)
      ..lineTo(s * 0.64, s * 0.48)
      ..lineTo(s * 0.50, s * 0.66)
      ..close();
    canvas.drawPath(pinPath, Paint()..shader = pin.createShader(bubbleRect));

    // Hollow centre of the pin head (location dot).
    canvas.drawCircle(pinHeadCenter, s * 0.055, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant UnigeriaMarkPainter oldDelegate) =>
      oldDelegate.tile != tile || oldDelegate.pin != pin;
}

/// Brand logo lockup per BRAND-KIT §1: gradient mark + wordmark rendered
/// together. A bare `Text` is never brand — always use this widget.
class MasanawaLogo extends StatelessWidget {
  const MasanawaLogo({
    super.key,
    this.dark = false,
    this.height = 96,
    this.showWordmark = true,
  });

  /// Render light-on-brand (splash / dark surface) or brand-mark variant.
  final bool dark;

  /// Vertical extent of the whole lockup.
  final double height;

  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final wordmarkColor = dark ? Colors.white : u.brand;
    return Semantics(
      label: 'Masanawa',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          UnigeriaMark(size: height * 0.62, dark: dark),
          if (showWordmark) ...[
            SizedBox(height: height * 0.10),
            Text(
              'Masanawa',
              style: TextStyle(
                fontSize: height * 0.24,
                fontWeight: FontWeight.w800,
                letterSpacing: -1,
                color: wordmarkColor,
                height: 1.0,
              ),
            ),
          ],
        ],
      ),
    );
  }
}