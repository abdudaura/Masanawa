import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/request_id.dart';
import '../../state/talk_safety_state.dart';
import '../../talks/talk_safety.dart';
import '../../theme/masanawa_theme.dart';

/// Reports an existing public Expert/Twin through the authenticated canonical
/// Talk safety API. It never applies punishment locally or infers report review.
class PersonaReportSheet extends ConsumerStatefulWidget {
  const PersonaReportSheet({
    super.key,
    required this.publicId,
    required this.displayName,
  });

  final String publicId;
  final String displayName;

  @override
  ConsumerState<PersonaReportSheet> createState() => _PersonaReportSheetState();
}

class _PersonaReportSheetState extends ConsumerState<PersonaReportSheet> {
  final TextEditingController _detail = TextEditingController();
  final String _requestId = createRequestId();
  TalkSafetyReportReason? _reason;
  TalkSafetyReportReason? _submittedReason;
  String? _submittedDetail;
  bool _sending = false;
  bool _accepted = false;
  String? _error;

  @override
  void dispose() {
    _detail.dispose();
    super.dispose();
  }

  String _safeError(Object failure) {
    if (failure is ApiException) {
      if (failure.statusCode == 401) {
        return 'Your session expired. Sign in again, then retry this report.';
      }
      if (failure.statusCode == 403) {
        return 'This account cannot submit the report.';
      }
      if (failure.statusCode == 429) {
        return 'Too many requests. Wait a moment and retry.';
      }
      if (failure.statusCode == 400 || failure.statusCode == 413) {
        return 'This report could not be accepted. Contact support.';
      }
    }
    return 'Could not confirm whether the report was received. Retry safely with the same request.';
  }

  Future<void> _submit() async {
    if (_sending || _accepted || _reason == null) return;
    // Freeze the payload and idempotency key on first attempt: a timeout can
    // occur *after* the server commits, so a retry must replay the same body.
    _submittedReason ??= _reason;
    _submittedDetail ??= _detail.text.trim();
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(talkSafetyTransportProvider).reportTarget(
        targetKind: TalkSafetyTargetKind.persona,
        targetId: widget.publicId,
        reason: _submittedReason!,
        detail: _submittedDetail!.isEmpty ? null : _submittedDetail,
        clientRequestId: _requestId,
      );
      if (!mounted) return;
      setState(() => _accepted = true);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _safeError(error));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.masanawa;
    final frozen = _submittedReason != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20, 14, 20, MediaQuery.viewInsetsOf(context).bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Report ${widget.displayName}',
                style: TextStyle(
                  color: theme.textPrimary, fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your report goes privately to Masanawa safety review. '
                'It does not automatically restrict this AI or its owner.',
                style: TextStyle(color: theme.textMuted),
              ),
              if (_accepted) ...[
                const SizedBox(height: 20),
                const Text(
                  'Report received for review.',
                  key: ValueKey('persona-report-confirmed'),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Close'),
                ),
              ] else ...[
                const SizedBox(height: 12),
                for (final reason in TalkSafetyReportReason.values)
                  RadioListTile<TalkSafetyReportReason>(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    value: reason,
                    groupValue: _reason,
                    title: Text(reason.label),
                    onChanged: frozen || _sending
                        ? null
                        : (value) => setState(() => _reason = value),
                  ),
                TextField(
                  key: const ValueKey('persona-report-detail'),
                  controller: _detail,
                  minLines: 2,
                  maxLines: 4,
                  maxLength: 2000,
                  readOnly: frozen || _sending,
                  decoration: const InputDecoration(
                    labelText: 'Additional details (optional)',
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    key: const ValueKey('persona-report-error'),
                    style: TextStyle(color: theme.emergency),
                  ),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    key: const ValueKey('persona-report-submit'),
                    onPressed: _sending || _reason == null ? null : _submit,
                    child: Text(
                      _sending
                          ? 'Sending…'
                          : frozen ? 'Retry same report' : 'Send report',
                    ),
                  ),
                ),
                if (frozen)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Your original report stays unchanged during retries.',
                      style: TextStyle(color: theme.textMuted),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
