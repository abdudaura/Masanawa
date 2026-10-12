import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

/// `Masanawa` with a small `Agents` sitting low at the end of the name.
/// The single brand lockup used in headers and splash.
class MasanawaWordmark extends StatelessWidget {
  const MasanawaWordmark({super.key, this.light = false, this.fontSize = 24});

  /// Light-on-brand variant (green headers, splash).
  final bool light;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final main = light ? Colors.white : u.brandStrong;
    final sub = light ? Colors.white.withValues(alpha: 0.85) : u.textMuted;
    return Semantics(
      label: 'Masanawa Agents',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            'Masanawa',
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
              color: main,
              height: 1.0,
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 4, bottom: 1),
            child: Text(
              'Agents',
              style: TextStyle(
                fontSize: fontSize * 0.48,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
                color: sub,
                height: 1.0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
