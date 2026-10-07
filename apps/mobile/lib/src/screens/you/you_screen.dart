import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

class YouScreen extends StatelessWidget {
  const YouScreen({
    super.key,
    this.onOpenProfile,
    this.onOpenMyTalks,
    this.onOpenMyTwin,
    this.onOpenSaved,
    this.onOpenWallet,
    this.onOpenBills,
    this.onOpenCrypto,
    this.onOpenSettings,
  });

  final VoidCallback? onOpenProfile;
  final VoidCallback? onOpenMyTalks;
  final VoidCallback? onOpenMyTwin;
  final VoidCallback? onOpenSaved;
  final VoidCallback? onOpenWallet;
  final VoidCallback? onOpenBills;
  final VoidCallback? onOpenCrypto;
  final VoidCallback? onOpenSettings;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('You')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
        children: [
          Material(
            color: u.surfaceCard,
            borderRadius: BorderRadius.circular(16),
            child: ListTile(
              onTap: onOpenProfile,
              contentPadding: const EdgeInsets.all(14),
              leading: CircleAvatar(
                radius: 27,
                backgroundColor: u.brandStrong,
                child: const Icon(Icons.person_rounded, color: Colors.white),
              ),
              title: Text(
                'Your profile',
                style: TextStyle(
                  color: u.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              subtitle: Text(
                'Profile, followers and public identity',
                style: TextStyle(color: u.textMuted),
              ),
              trailing: Icon(Icons.chevron_right_rounded, color: u.textMuted),
            ),
          ),
          const SizedBox(height: 12),
          _YouRow(
            icon: Icons.podcasts_outlined,
            label: 'My Talks',
            onTap: onOpenMyTalks,
          ),
          _YouRow(
            icon: Icons.auto_awesome_outlined,
            label: 'My Twin',
            onTap: onOpenMyTwin,
          ),
          _YouRow(
            icon: Icons.bookmark_border_rounded,
            label: 'Saved Talks',
            onTap: onOpenSaved,
          ),
          const SizedBox(height: 10),
          _YouRow(
            icon: Icons.account_balance_wallet_outlined,
            label: 'Wallet & earnings',
            onTap: onOpenWallet,
          ),
          _YouRow(
            icon: Icons.receipt_long_outlined,
            label: 'Bills',
            onTap: onOpenBills,
          ),
          _YouRow(
            icon: Icons.currency_bitcoin_rounded,
            label: 'Crypto',
            onTap: onOpenCrypto,
          ),
          const SizedBox(height: 10),
          _YouRow(
            icon: Icons.settings_outlined,
            label: 'Settings & privacy',
            onTap: onOpenSettings,
          ),
        ],
      ),
    );
  }
}

class _YouRow extends StatelessWidget {
  const _YouRow({required this.icon, required this.label, this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, color: u.brandStrong),
        title: Text(
          label,
          style: TextStyle(color: u.textPrimary, fontWeight: FontWeight.w500),
        ),
        trailing: Icon(Icons.chevron_right_rounded, color: u.textMuted),
        shape: Border(bottom: BorderSide(color: u.structuralBorder, width: .7)),
      ),
    );
  }
}
