import 'package:flutter/material.dart';

import '../../../owner_access/owner_access.dart';
import '../../../theme/masanawa_theme.dart';

class OwnerAccessStatusCard extends StatelessWidget {
  const OwnerAccessStatusCard({
    super.key,
    required this.request,
  });

  final OwnerAccessRequest request;

  String get statusText {
    switch (request.state) {
      case OwnerAccessState.requested: return 'Waiting for owner';
      case OwnerAccessState.accepted: return 'Accepted';
      case OwnerAccessState.scheduled: return 'Scheduled';
      case OwnerAccessState.active: return 'Happening now';
      case OwnerAccessState.completed: return 'Completed';
      case OwnerAccessState.settled: return 'Paid';
      case OwnerAccessState.declined: return 'Declined';
      case OwnerAccessState.expired: return 'Expired';
      case OwnerAccessState.cancelled: return 'Cancelled';
      case OwnerAccessState.noShow: return 'No-show';
      case OwnerAccessState.refunded: return 'Refunded';
      case OwnerAccessState.disputed: return 'Under review';
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Row(
        children: [
          Icon(Icons.person_outline, color: u.brand),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Talk to owner',
                  style: TextStyle(
                    color: u.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  statusText,
                  style: TextStyle(color: u.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          if (request.priceCredits > 0)
            Text(
              '${request.priceCredits} Cr',
              style: TextStyle(
                color: u.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
        ],
      ),
    );
  }
}
