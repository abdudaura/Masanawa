import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

/// The Masanawa conversation lettermark, shared with the native launcher.
/// Keep the packaged artwork as the source of truth for the brand.
class MasanawaMark extends StatelessWidget {
  const MasanawaMark({
    super.key,
    this.size = 72,
    this.dark = false,
  });

  final double size;

  /// Retained for call-site compatibility. The approved artwork is identical
  /// in light and dark contexts.
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Semantics(
      label: 'Masanawa agent',
      image: true,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * 0.22),
          boxShadow: [
            BoxShadow(
              color: u.brand.withValues(alpha: 0.22),
              blurRadius: size * 0.18,
              offset: Offset(0, size * 0.06),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.asset(
          'assets/brand/masanawa_agent_logo.png',
          width: size,
          height: size,
          fit: BoxFit.cover,
          filterQuality: FilterQuality.high,
          errorBuilder: (errorContext, error, stackTrace) => Container(
            color: u.brand,
            child: Center(
              child: Icon(
                Icons.forum_rounded,
                color: Colors.white,
                size: size * 0.56,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class MasanawaLogo extends StatelessWidget {
  const MasanawaLogo({
    super.key,
    this.dark = false,
    this.height = 96,
    this.showWordmark = true,
  });

  final bool dark;
  final double height;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final wordmarkColor = dark ? Colors.white : u.brandStrong;
    return Semantics(
      label: 'Masanawa',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          MasanawaMark(size: height * 0.62, dark: dark),
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
