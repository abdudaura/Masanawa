import 'package:flutter/material.dart';

import '../../talks/talk_gift.dart';
import '../../theme/masanawa_theme.dart';

/// Local sender acknowledgment only. Cross-device/stage event distribution
/// depends on authoritative R09 events and is NOT simulated here.
class TalkGiftStageOverlay extends StatelessWidget {
  const TalkGiftStageOverlay({
    super.key,
    required this.receipt,
    required this.item,
  });

  final TalkGiftReceipt receipt;
  final TalkGiftCatalogItem item;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final reduceMotion = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    final surface = Semantics(
      liveRegion: true,
      label: '${item.name} gift sent to ${receipt.recipientName}, ${receipt.amountCredits} Credits',
      child: ExcludeSemantics(
        child: Material(
          color: u.surfaceCard,
          elevation: 3,
          borderRadius: BorderRadius.circular(18),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 260),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            decoration: BoxDecoration(
              border: Border.all(color: u.structuralBorder),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(talkGiftIcon(item.visual), size: 34, color: u.brandStrong),
                const SizedBox(width: 10),
                Flexible(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.name, style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700, color: u.textPrimary,
                      )),
                      Text('Sent to ${receipt.recipientName}',
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: u.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    return SafeArea(
      child: IgnorePointer(
        child: Align(
          alignment: Alignment.topCenter,
          child: Padding(
            padding: const EdgeInsets.only(top: 46, left: 16, right: 16),
            child: reduceMotion
                ? surface
                : TweenAnimationBuilder<double>(
                    key: ValueKey(receipt.giftId),
                    tween: Tween(begin: 0.85, end: 1),
                    duration: const Duration(milliseconds: 360),
                    curve: Curves.easeOutBack,
                    builder: (context, scale, child) =>
                        Transform.scale(scale: scale, child: child),
                    child: surface,
                  ),
          ),
        ),
      ),
    );
  }
}

IconData talkGiftIcon(String visual) => switch (visual) {
  'applause' => Icons.front_hand_rounded,
  'heart' => Icons.favorite_rounded,
  'flower' => Icons.local_florist_rounded,
  'spark' => Icons.auto_awesome_rounded,
  'crown' => Icons.workspace_premium_rounded,
  'celebration' => Icons.celebration_rounded,
  _ => Icons.card_giftcard_rounded,
};
