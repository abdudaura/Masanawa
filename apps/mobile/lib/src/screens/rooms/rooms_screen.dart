import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

/// [scaffold] Audio rooms land here (follow-up unit: membership, roles,
/// invites, live room state).
class RoomsScreen extends StatelessWidget {
  const RoomsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Rooms')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.groups_outlined, size: 58, color: u.brand),
              const SizedBox(height: 18),
              Text(
                'No rooms yet',
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Audio rooms you join will appear here.',
                textAlign: TextAlign.center,
                style: TextStyle(color: u.textMuted, fontSize: 14, height: 1.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
