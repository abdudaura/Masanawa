import 'package:flutter/material.dart';

import '../../../theme/masanawa_theme.dart';

enum TwinConversationPresence {
  aiTwin,
  humanOwner,
}

class TwinIdentityBanner extends StatelessWidget {
  const TwinIdentityBanner({
    super.key,
    required this.ownerName,
    required this.presence,
  });

  final String ownerName;
  final TwinConversationPresence presence;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final human = presence == TwinConversationPresence.humanOwner;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        border: Border(
          bottom: BorderSide(color: u.structuralBorder),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: u.brand.withValues(alpha: .10),
            child: Icon(
              human ? Icons.person_outline : Icons.auto_awesome_outlined,
              size: 18,
              color: u.brand,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  human
                      ? '$ownerName joined'
                      : "$ownerName's AI twin",
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  human
                      ? 'You are now talking to the real owner.'
                      : 'You are talking to an AI representative, not the human owner.',
                  style: TextStyle(
                    color: u.textMuted,
                    fontSize: 11,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: u.surfaceMuted,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              human ? 'Owner' : 'AI twin',
              style: TextStyle(
                color: u.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
