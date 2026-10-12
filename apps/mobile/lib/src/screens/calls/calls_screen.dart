import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';

/// [scaffold] Call history lands here (follow-up unit: recents list,
/// incoming-call screen, reconnect states).
class CallsScreen extends StatelessWidget {
  const CallsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Calls')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.call_outlined, size: 58, color: u.brand),
              const SizedBox(height: 18),
              Text(
                'No recent calls',
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your call history will appear here.',
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
