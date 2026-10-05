import 'package:flutter/material.dart';

import '../../../theme/masanawa_theme.dart';

class TwinChatActionsSheet extends StatelessWidget {
  const TwinChatActionsSheet({
    super.key,
    required this.ownerName,
    required this.onGift,
    required this.onBuy,
    required this.onRequestOwner,
    required this.onViewProfile,
    this.giftsEnabled = true,
    this.ownerAccessEnabled = true,
  });

  final String ownerName;
  final VoidCallback onGift;
  final VoidCallback onBuy;
  final VoidCallback onRequestOwner;
  final VoidCallback onViewProfile;
  final bool giftsEnabled;
  final bool ownerAccessEnabled;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: u.structuralBorder,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            _ActionTile(
              icon: Icons.shopping_bag_outlined,
              title: 'Buy something',
              subtitle: 'Airtime, data, bills and other Masanawa services',
              onTap: onBuy,
            ),
            if (giftsEnabled)
              _ActionTile(
                icon: Icons.card_giftcard_outlined,
                title: 'Bless $ownerName',
                subtitle: 'Send a voluntary gift',
                onTap: onGift,
              ),
            if (ownerAccessEnabled)
              _ActionTile(
                icon: Icons.person_outline,
                title: 'Talk to $ownerName',
                subtitle: 'Request a short conversation with the real owner',
                onTap: onRequestOwner,
              ),
            _ActionTile(
              icon: Icons.account_circle_outlined,
              title: 'View twin profile',
              subtitle: 'About this AI twin and its owner-approved profile',
              onTap: onViewProfile,
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListTile(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
      ),
      leading: CircleAvatar(
        backgroundColor: u.brand.withValues(alpha: .10),
        child: Icon(icon, color: u.brand, size: 20),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: u.textPrimary,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          color: u.textMuted,
          fontSize: 12,
        ),
      ),
      onTap: onTap,
    );
  }
}
