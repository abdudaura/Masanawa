import 'package:flutter/material.dart';

import '../../../owner_access/owner_access.dart';
import '../../../theme/masanawa_theme.dart';

class OwnerAccessManageSheet extends StatelessWidget {
  const OwnerAccessManageSheet({
    super.key,
    required this.request,
    required this.onAccept,
    required this.onDecline,
    required this.onSchedule,
  });

  final OwnerAccessRequest request;
  final Future<void> Function() onAccept;
  final Future<void> Function() onDecline;
  final Future<void> Function(DateTime when) onSchedule;

  Future<void> _pickSchedule(BuildContext context) async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 90)),
      initialDate: request.scheduledFor ?? now,
    );
    if (date == null || !context.mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(
        request.scheduledFor ?? now.add(const Duration(hours: 1)),
      ),
    );
    if (time == null) return;
    await onSchedule(
      DateTime(date.year, date.month, date.day, time.hour, time.minute),
    );
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: u.structuralBorder,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Someone wants to talk to you',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${request.durationMinutes} min · ${request.modality.name}',
              style: TextStyle(color: u.textMuted),
            ),
            const SizedBox(height: 6),
            Text(
              request.priceCredits == 0
                  ? 'Trial session · no charge'
                  : 'You earn after the qualifying session is completed.',
              style: TextStyle(color: u.textMuted, height: 1.4),
            ),
            const SizedBox(height: 20),
            if (request.state == OwnerAccessState.requested) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () async => onAccept(),
                  child: const Text('Accept'),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () async => onDecline(),
                  child: const Text('Decline'),
                ),
              ),
            ] else if (request.state == OwnerAccessState.accepted) ...[
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => _pickSchedule(context),
                  child: const Text('Choose time'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
