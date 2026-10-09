import 'package:flutter/material.dart';

/// A persistent disclosure for private Expert/Twin and support-agent chats.
/// The runtime-reported presence remains visible, but never replaces AI identity.
class AiPersonaStatusLabel extends StatelessWidget {
  const AiPersonaStatusLabel({
    super.key,
    required this.status,
    this.style,
  });

  final String status;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    final safeStatus = status.trim();
    return Text(
      safeStatus.isEmpty ? 'AI persona' : 'AI · $safeStatus',
      semanticsLabel:
          safeStatus.isEmpty ? 'AI persona' : 'AI persona, $safeStatus',
      overflow: TextOverflow.ellipsis,
      style: style,
    );
  }
}
