import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../safety/twin_safety.dart';
import '../../../safety/twin_safety_state.dart';
import '../../../theme/masanawa_theme.dart';

class TwinSafetySheet extends ConsumerWidget {
  const TwinSafetySheet({
    super.key,
    required this.characterId,
    required this.displayName,
    this.isBlocked = false,
  });

  final String characterId;
  final String displayName;
  final bool isBlocked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final working = ref.watch(twinSafetyControllerProvider).isLoading;

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
            const SizedBox(height: 18),
            Text(
              displayName,
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                isBlocked ? Icons.lock_open_outlined : Icons.block_outlined,
                color: u.textPrimary,
              ),
              title: Text(isBlocked ? 'Unblock twin' : 'Block twin'),
              subtitle: Text(
                isBlocked
                    ? 'Allow this twin to interact with you again.'
                    : 'Hide this twin and stop direct interaction.',
              ),
              enabled: !working,
              onTap: () async {
                final controller =
                    ref.read(twinSafetyControllerProvider.notifier);
                final ok = isBlocked
                    ? await controller.unblock(characterId)
                    : await controller.block(characterId);
                if (ok && context.mounted) Navigator.of(context).pop();
              },
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.flag_outlined, color: u.textPrimary),
              title: const Text('Report'),
              subtitle: const Text(
                'Send a safety report for review. Reporting does not automatically punish the owner.',
              ),
              enabled: !working,
              onTap: () async {
                Navigator.of(context).pop();
                await showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => TwinReportSheet(
                    characterId: characterId,
                    displayName: displayName,
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class TwinReportSheet extends ConsumerStatefulWidget {
  const TwinReportSheet({
    super.key,
    required this.characterId,
    required this.displayName,
  });

  final String characterId;
  final String displayName;

  @override
  ConsumerState<TwinReportSheet> createState() => _TwinReportSheetState();
}

class _TwinReportSheetState extends ConsumerState<TwinReportSheet> {
  TwinReportReason? _reason;
  final _detail = TextEditingController();

  @override
  void dispose() {
    _detail.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final working = ref.watch(twinSafetyControllerProvider).isLoading;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Report ${widget.displayName}',
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Choose the closest reason. A report asks Masanawa to review the twin; it is not an automatic verdict.',
                style: TextStyle(color: u.textMuted, height: 1.4),
              ),
              const SizedBox(height: 14),
              for (final reason in TwinReportReason.values)
                RadioListTile<TwinReportReason>(
                  contentPadding: EdgeInsets.zero,
                  value: reason,
                  groupValue: _reason,
                  title: Text(twinReportReasonLabel(reason)),
                  onChanged: working
                      ? null
                      : (value) => setState(() => _reason = value),
                ),
              const SizedBox(height: 8),
              TextField(
                controller: _detail,
                minLines: 2,
                maxLines: 4,
                maxLength: 1000,
                decoration: const InputDecoration(
                  labelText: 'More details (optional)',
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: working || _reason == null
                      ? null
                      : () async {
                          final ok = await ref
                              .read(twinSafetyControllerProvider.notifier)
                              .report(
                                characterId: widget.characterId,
                                reason: _reason!,
                                detail: _detail.text.trim().isEmpty
                                    ? null
                                    : _detail.text.trim(),
                              );
                          if (ok && mounted) Navigator.of(context).pop();
                        },
                  child: Text(working ? 'Sending…' : 'Send report'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
