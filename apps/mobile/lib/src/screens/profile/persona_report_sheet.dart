import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/request_id.dart';
import '../../state/session_state.dart';
import '../../state/talk_safety_state.dart';
import '../../talks/talk_safety.dart';
import 'persona_report_journal.dart';

/// Real POST /safety/reports. Retain one request key across uncertain retries.
Future<void> showPersonaReportSheet(
  BuildContext context, {
  required String publicId,
  required String displayName,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _PersonaReportSheet(
      publicId: publicId,
      displayName: displayName,
    ),
  );
}

class _PersonaReportSheet extends ConsumerStatefulWidget {
  const _PersonaReportSheet({
    required this.publicId,
    required this.displayName,
  });

  final String publicId;
  final String displayName;

  @override
  ConsumerState<_PersonaReportSheet> createState() =>
      _PersonaReportSheetState();
}

class _PersonaReportSheetState extends ConsumerState<_PersonaReportSheet> {
  final _detail = TextEditingController();
  TalkSafetyReportReason? _reason;
  bool _busy = false;
  bool _attempted = false;
  bool _confirmed = false;
  String? _error;
  String? _senderId;
  bool _ready = false;
  String? _journalOwner;
  String? _journalError;
  late String _requestId = createRequestId();

  @override
  void initState() {
    super.initState();
    final session = ref.read(sessionProvider);
    if (session is SessionSignedIn) {
      _restoreFor(session.user.id);
    }
  }

  Future<void> _restoreFor(String ownerId) async {
    if (_journalOwner != null) return;
    _journalOwner = ownerId;
    try {
      final pending = await ref.read(personaReportJournalProvider).read(
        userId: ownerId,
        publicId: widget.publicId,
      );
      if (!mounted) return;
      final session = ref.read(sessionProvider);
      if (session is! SessionSignedIn || session.user.id != ownerId) return;
      setState(() {
        if (pending != null) {
          _reason = pending.reason;
          _detail.text = pending.detail;
          _requestId = pending.clientRequestId;
          _attempted = true;
          _senderId = ownerId;
        }
        _ready = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _journalError = 'Could not recover the previous report securely. '
            'Nothing will be sent. Reopen after secure storage is available.';
      });
    }
  }

  @override
  void dispose() {
    _detail.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || _confirmed || _reason == null || !_ready ||
        _journalError != null) return;
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn) {
      setState(() => _error = 'Sign in before sending a private report.');
      return;
    }
    if (_senderId != null && _senderId != session.user.id) {
      setState(() => _error = 'Your account changed. Close this report and reopen it.');
      return;
    }
    _senderId = session.user.id;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // Save *before* network dispatch. Failed secure writes must not send.
      if (!_attempted) {
        await ref.read(personaReportJournalProvider).write(
          PendingPersonaReport(
            userId: session.user.id,
            publicId: widget.publicId,
            clientRequestId: _requestId,
            reason: _reason!,
            detail: _detail.text.trim(),
          ),
        );
        if (!mounted) return;
        final current = ref.read(sessionProvider);
        if (current is! SessionSignedIn || current.user.id != _senderId) return;
        setState(() => _attempted = true);
      }
      await ref.read(talkSafetyTransportProvider).reportTarget(
        targetKind: TalkSafetyTargetKind.persona,
        targetId: widget.publicId,
        reason: _reason!,
        detail: _detail.text.trim(),
        clientRequestId: _requestId,
      );
      if (!mounted) return;
      final current = ref.read(sessionProvider);
      if (current is! SessionSignedIn || current.user.id != _senderId) {
        setState(() => _error = 'Your account changed. Close this report.');
        return;
      }
      setState(() => _confirmed = true);
      try {
        await ref.read(personaReportJournalProvider).clear(
          userId: _senderId!,
          publicId: widget.publicId,
        );
      } catch (_) {
        // Receipt already confirmed. Retaining this key is safe: the server
        // deduplicates any recovered retry after process death.
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = _attempted
            ? 'Could not confirm whether the report was received. '
              'Retry sends the same request without creating a second report.'
            : 'Could not securely save the report. Nothing was sent; retry.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    ref.listen<SessionState>(sessionProvider, (previous, next) {
      if (next is SessionSignedIn && _journalOwner == null) {
        _restoreFor(next.user.id);
      }
    });
    final signedIn = session is SessionSignedIn;
    final accountChanged = _senderId != null &&
        (session is! SessionSignedIn || session.user.id != _senderId);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16, 12, 16, 16 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.83,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Report AI persona',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(widget.displayName,
                maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 8),
            const Text('Reports are private and reviewed by Masanawa. '
                'Reporting does not automatically block a persona.'),
            if (!signedIn)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('Sign in to report this AI persona.'),
              ),
            if (accountChanged)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('Your account changed. Close and reopen this report.'),
              ),
            if (_confirmed) ...[
              const SizedBox(height: 20),
              const Text('Report received by Masanawa.',
                  key: ValueKey('persona-report-confirmed')),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Close'),
              ),
            ] else ...[
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final reason in TalkSafetyReportReason.values)
                      RadioListTile<TalkSafetyReportReason>(
                        key: ValueKey('persona-reason-' + reason.wire),
                        title: Text(reason.label),
                        value: reason,
                        groupValue: _reason,
                        onChanged: _busy || _attempted || !signedIn
                            ? null
                            : (value) => setState(() => _reason = value),
                        dense: true,
                      ),
                  ],
                ),
              ),
              TextField(
                key: const ValueKey('persona-report-detail'),
                controller: _detail,
                maxLength: 2000,
                enabled: !_attempted && signedIn,
                minLines: 1,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Details (optional)',
                  hintText: 'Describe what happened',
                ),
              ),
              if (_journalError != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    _journalError!,
                    key: const ValueKey('persona-report-journal-error'),
                  ),
                ),
              if (_attempted && !_confirmed)
                const Text('An earlier attempt may have been received. '
                    'Retry uses the original request key.'),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    _error!,
                    key: const ValueKey('persona-report-error'),
                  ),
                ),
              FilledButton.icon(
                key: const ValueKey('persona-report-submit'),
                onPressed: _busy || !_ready || _journalError != null ||
                    _reason == null || !signedIn || accountChanged
                    ? null
                    : _submit,
                icon: _busy
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.flag_outlined),
                label: Text(_attempted ? 'Retry same report' : 'Send report'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
