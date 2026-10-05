import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

/// The approved Masanawa agent-language mark.
///
/// Keep this mark aligned with the native Android launcher/splash artwork:
/// a blue conversation surface with a clear white agent-chat symbol.
class MasanawaMark extends StatelessWidget {
  const MasanawaMark({
    super.key,
    this.size = 72,
    this.dark = false,
  });

  final double size;

  /// Retained for call-site compatibility.
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
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF1647F5),
              Color(0xFF0A6FFA),
              Color(0xFF36C7F4),
            ],
          ),
          boxShadow: [
            BoxShadow(
              color: u.brand.withValues(alpha: 0.22),
              blurRadius: size * 0.18,
              offset: Offset(0, size * 0.06),
            ),
          ],
        ),
        child: Center(
          child: Icon(
            Icons.forum_rounded,
            color: Colors.white,
            size: size * 0.58,
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
