import 'dart:math';
import 'package:flutter/material.dart';
import 'audio_post_transport.dart';
import 'audio_post_draft_store.dart';
import 'audio_post_media_contract.dart';
import 'audio_post_capture_sheet.dart';
export 'audio_post_media_contract.dart';

/// AF09 composer. AF00 mounts it from Talks and injects AF05 verified media.
class AudioPostComposerScreen extends StatefulWidget {
  const AudioPostComposerScreen({
    super.key, required this.transport, required this.accountId,
    required this.isCurrentAccount, this.acquireVerifiedAudio,
    this.uploadVerifiedAudio, this.onPublished, this.newRequestId, this.attemptStore,
  });
  final AudioPostTransport transport;
  final String accountId;
  final bool Function(String) isCurrentAccount;
  final AcquireVerifiedPostAudio? acquireVerifiedAudio;
  /// Optional AF05/AF15 authenticated private upload; never a local-only asset.
  final UploadVerifiedTalkAudio? uploadVerifiedAudio;
  final ValueChanged<AudioPost>? onPublished;
  final String Function()? newRequestId;
  final TalkPublishAttemptStore? attemptStore;
  @override
  State<AudioPostComposerScreen> createState() => _ComposerState();
}

class _ComposerState extends State<AudioPostComposerScreen> {
  final _title = TextEditingController();
  VerifiedPostAudio? _audio;
  AudioPost? _receipt;
  String? _requestId, _message;
  final TalkPublishAttemptStore _defaultStore = SecureTalkPublishAttemptStore();
  TalkPublishAttemptStore get _store => widget.attemptStore ?? _defaultStore;
  bool _acquiring = false, _sending = false, _attempted = false;
  bool _restoring = true, _restoreFailed = false, _saving = false;
  bool _checkingStatus = false;
  int _generation = 0;
  bool get _authorized => widget.accountId.trim().isNotEmpty &&
      widget.isCurrentAccount(widget.accountId);
  bool get _hasCapture => widget.acquireVerifiedAudio != null ||
      widget.uploadVerifiedAudio != null;
  bool get _validTitle {
    final t = _title.text.trim();
    return t.isNotEmpty && t.length <= 100 &&
        !RegExp(r'[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]').hasMatch(t);
  }
  bool get _canPublish => _authorized && _audio?.isPlausible == true &&
      _validTitle && !_restoring && !_restoreFailed && !_saving &&
      !_acquiring && !_sending && _receipt == null;
  String _makeKey() => widget.newRequestId?.call() ?? (
    'talk-' + DateTime.now().microsecondsSinceEpoch.toRadixString(36) +
    '-' + Random.secure().nextInt(0x7fffffff).toRadixString(36)
  );

  @override
  void initState() {
    super.initState();
    _title.addListener(_refresh);
    _restorePending();
  }
  void _refresh() { if (mounted) setState(() {}); }

  /// Recovered drafts never auto-submit. A user may retry the same key.
  Future<void> _restorePending() async {
    final generation = ++_generation;
    final accountId = widget.accountId;
    _restoring = true;
    _restoreFailed = false;
    try {
      final pending = await _store.read(accountId);
      if (!mounted || generation != _generation || !_authorized) return;
      setState(() {
        _restoring = false;
        if (pending != null) {
          // TextEditingController listeners must not schedule nested setState.
          _title.removeListener(_refresh);
          _title.text = pending.title;
          _title.addListener(_refresh);
          _audio = VerifiedPostAudio(
            assetId: pending.assetId, durationMs: pending.durationMs);
          _requestId = pending.requestId;
          _attempted = true;
          _message = 'An earlier publish attempt is unconfirmed. Check My Talks, '
              'then retry using the same request ID or discard it.';
        }
      });
    } catch (_) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _restoring = false;
        _restoreFailed = true;
        _message = 'Secure publish recovery is unavailable. '
            'Retry recovery before publishing a new Talk.';
      });
    }
  }
  void _clear() {
    ++_generation;
    _audio = null; _receipt = null; _requestId = null; _message = null;
    _attempted = false; _acquiring = false; _sending = false;
    _checkingStatus = false;
    _restoring = false; _restoreFailed = false; _saving = false;
    _title.clear();
  }
  @override
  void didUpdateWidget(covariant AudioPostComposerScreen old) {
    super.didUpdateWidget(old);
    if (old.accountId != widget.accountId || old.transport != widget.transport ||
        old.attemptStore != widget.attemptStore) {
      // didUpdateWidget already schedules rebuild; avoid notifying an old
      // TextEditingController listener while the account switch is building.
      _title.removeListener(_refresh);
      _clear();
      _title.addListener(_refresh);
      _restorePending();
    }
  }
  @override
  void dispose() {
    ++_generation;
    _title.removeListener(_refresh);
    _title.dispose();
    super.dispose();
  }
  Future<void> _record() async {
    if (!_authorized || _restoring || _restoreFailed || _saving ||
        _acquiring || _attempted || !_hasCapture) return;
    final generation = ++_generation;
    setState(() { _acquiring = true; _message = null; });
    try {
      final next = widget.acquireVerifiedAudio != null
          ? await widget.acquireVerifiedAudio!()
          : await showTalkCaptureSheet(context,
              accountId: widget.accountId,
              isCurrentAccount: widget.isCurrentAccount,
              upload: widget.uploadVerifiedAudio);
      if (!mounted || !_authorized || generation != _generation) return;
      if (next != null && !next.isPlausible) {
        setState(() => _message = 'Verified audio must be between 1 second and 3 minutes.');
      } else if (next != null) {
        setState(() { _audio = next; _requestId = null; });
      }
    } on AudioCaptureException catch (error) {
      if (!mounted || !_authorized || generation != _generation) return;
      setState(() => _message = switch (error.reason) {
        AudioCaptureFailure.permission => 'Allow microphone permission in settings and retry.',
        AudioCaptureFailure.offline => 'Upload failed. Reconnect and retry.',
        AudioCaptureFailure.tooLong => 'Talks cannot exceed three minutes.',
        AudioCaptureFailure.unavailable => 'Recording is unavailable on this device.',
        AudioCaptureFailure.other => 'Could not prepare recording. Retry.',
      });
    } catch (_) {
      if (mounted && _authorized && generation == _generation) {
        setState(() => _message = 'Could not prepare recording. Retry.');
      }
    } finally {
      if (mounted && generation == _generation) setState(() => _acquiring = false);
    }
  }
  Future<void> _publish() async {
    if (!_canPublish) return;
    final generation = _generation;
    final title = _title.text.trim();
    final assetId = _audio!.assetId;
    final requestId = _requestId ??= _makeKey();
    if (!RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$').hasMatch(requestId)) {
      setState(() => _message = 'Invalid request ID. Cannot publish.');
      return;
    }
    final accountId = widget.accountId;
    final wasAttempted = _attempted;
    final attempt = PendingTalkPublish(
      accountId: accountId, requestId: requestId, assetId: assetId,
      durationMs: _audio!.durationMs, title: title,
    );
    // Never contact the server until a retry-safe key survives app restart.
    setState(() { _saving = true; _message = null; });
    try {
      await _store.write(attempt);
      if (!mounted || !_authorized || generation != _generation) return;
      setState(() { _saving = false; _sending = true; _attempted = true; });
      // On an uncertain retry, check persisted server state before another POST.
      // Lookup is read-only, scoped by the authenticated Gateway session. A
      // failed lookup never causes an unsafe second request.
      AudioPost? recovered;
      if (wasAttempted && widget.transport is AudioPostReceiptLookup) {
        recovered = await (widget.transport as AudioPostReceiptLookup)
            .receiptByRequest(requestId: requestId);
        if (!mounted || !_authorized || generation != _generation) return;
      }
      final post = recovered ?? await widget.transport.publish(
        requestId: requestId, assetId: assetId, title: title,
      );
      if (!mounted || !_authorized || generation != _generation) return;
      if (post.title != title ||
          (post.status != 'processing' && post.status != 'published' &&
           post.status != 'failed' && post.status != 'removed')) {
        throw const FormatException('Invalid publish receipt');
      }
      // Keep the server receipt even if cleanup cannot remove the saved key.
      setState(() => _receipt = post);
      try { await _store.clear(accountId, requestId); } catch (_) { /* safe replay */ }
      if (!mounted || !_authorized || generation != _generation) return;
      if (post.status == 'processing' || post.status == 'published') {
        try { widget.onPublished?.call(post); } catch (_) { /* receipt retained */ }
      }
    } catch (_) {
      if (mounted && _authorized && generation == _generation) {
        setState(() => _message = _attempted
          ? 'Publication is unconfirmed. Retry uses the same request ID.'
          : 'Could not save secure publish recovery. No request was sent. Retry.');
      }
    } finally {
      if (mounted && generation == _generation) {
        setState(() { _saving = false; _sending = false; });
      }
    }
  }
  /// A 202 receipt means the post is accepted, not publicly available yet.
  /// Read the existing server receipt only; never submit a second publish here.
  Future<void> _checkPublishStatus() async {
    final receipt = _receipt;
    final requestId = _requestId;
    if (!_authorized || _checkingStatus || _saving || _sending || _acquiring ||
        receipt == null || receipt.status != 'processing' || requestId == null ||
        widget.transport is! AudioPostReceiptLookup) return;
    final generation = _generation;
    final accountId = widget.accountId;
    setState(() { _checkingStatus = true; _message = null; });
    try {
      final latest = await (widget.transport as AudioPostReceiptLookup)
          .receiptByRequest(requestId: requestId);
      if (!mounted || generation != _generation || !_authorized ||
          widget.accountId != accountId || _requestId != requestId) return;
      // Only the authenticated request's exact post can advance this receipt.
      // Absence/offline/malformed responses cannot turn an acknowledged
      // publication back into a missing post or trigger another charge/upload.
      if (latest == null || latest.postId != receipt.postId ||
          latest.title != receipt.title ||
          latest.durationMs != receipt.durationMs ||
          latest.authorId != receipt.authorId ||
          latest.authorKind != receipt.authorKind ||
          latest.revision < receipt.revision) {
        throw const FormatException('Inconsistent publication status');
      }
      setState(() {
        _receipt = latest;
        _message = latest.status == 'processing'
            ? 'Still processing. Check again later.'
            : null;
      });
      if (latest.status == 'published') {
        try { widget.onPublished?.call(latest); } catch (_) { /* receipt retained */ }
      }
    } catch (_) {
      if (mounted && generation == _generation && _authorized) {
        setState(() => _message =
            'Could not confirm the latest status. Your Talk was already '
            'received; reconnect and check again without reposting.');
      }
    } finally {
      if (mounted && generation == _generation) {
        // Logout may deny the read while this widget is retained. Clear the
        // spinner without restoring any previous-account result.
        setState(() => _checkingStatus = false);
      }
    }
  }

  Future<void> _discard() async {
    if (_sending || _saving || _restoring || _checkingStatus) return;
    final generation = _generation;
    final accountId = widget.accountId;
    final requestId = _requestId;
    if (_attempted) {
      final yes = await showDialog<bool>(context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('Discard publish attempt?'),
          content: const Text('This Talk may still be processing. Check My Talks before reposting.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false),
              child: const Text('Keep draft')),
            TextButton(onPressed: () => Navigator.pop(dialog, true),
              child: const Text('Discard')),
          ],
        ));
      if (yes != true || !mounted || !_authorized || generation != _generation) return;
    }
    try {
      if (requestId != null) {
        await _store.clear(accountId, requestId);
      }
      if (mounted && _authorized && generation == _generation &&
          widget.accountId == accountId) setState(_clear);
    } catch (_) {
      if (mounted && _authorized && generation == _generation) {
        setState(() => _message = 'Could not clear secure recovery. Retry discard.');
      }
    }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Create audio Talk')),
    body: !_authorized
      ? const Center(child: Text('Sign in to publish audio Talks.'))
      : SafeArea(child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Record an audio Talk', style: Theme.of(context).textTheme.titleLarge),
          const Text('Up to three minutes. Audio is verified before publication.'),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            key: const ValueKey('talk-record'),
            onPressed: !_hasCapture || _attempted ||
                _restoring || _restoreFailed || _saving ||
                _acquiring || _sending || _receipt != null ? null : _record,
            icon: const Icon(Icons.mic_outlined),
            label: Text(_acquiring ? 'Preparing audio…' :
                _audio == null ? 'Record audio' : 'Replace recording'),
          ),
          if (!_hasCapture)
            const Text('Recording and verified upload are not configured in this build.'),
          if (_audio != null)
            Text('Verified audio: ' + (_audio!.durationMs / 1000).ceil().toString() + ' seconds'),
          const SizedBox(height: 14),
          TextField(
            key: const ValueKey('talk-title'),
            controller: _title,
            maxLength: 100,
            maxLines: 2,
            readOnly: _attempted || _restoring || _restoreFailed ||
                _saving || _sending || _receipt != null,
            decoration: const InputDecoration(
              labelText: 'Title', border: OutlineInputBorder(),
              hintText: 'What is this audio Talk about?',
            ),
          ),
          if (_restoring)
            const LinearProgressIndicator(key: ValueKey('talk-restoring')),
          if (_message != null)
            Text(_message!, key: const ValueKey('talk-error')),
          if (_restoreFailed)
            TextButton(
              key: const ValueKey('talk-retry-recovery'),
              onPressed: _restorePending,
              child: const Text('Retry secure recovery'),
            ),
          if (_receipt != null)
            Text(switch (_receipt!.status) {
              'published' => 'Talk published.',
              'processing' => 'Talk received; it is processing and is not public yet.',
              'failed' => 'Talk was not approved. Check My Talks before recording again.',
              _ => 'This publish attempt refers to a removed Talk.',
            }, key: const ValueKey('talk-receipt')),
          if (_receipt?.status == 'processing' &&
              widget.transport is AudioPostReceiptLookup)
            TextButton.icon(
              key: const ValueKey('talk-check-status'),
              onPressed: _authorized && !_checkingStatus && !_sending && !_saving
                  ? _checkPublishStatus : null,
              icon: _checkingStatus
                  ? const SizedBox(width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.refresh),
              label: Text(_checkingStatus ? 'Checking status…' : 'Check publication status'),
            ),
          const SizedBox(height: 14),
          FilledButton.icon(
            key: const ValueKey('talk-publish'),
            onPressed: _canPublish ? _publish : null,
            icon: _sending || _saving ? const SizedBox(
              width: 16, height: 16,
              child: CircularProgressIndicator(strokeWidth: 2)) :
              const Icon(Icons.publish_outlined),
            label: Text(_saving ? 'Saving retry…' : _sending ? 'Submitting…' :
                _attempted ? 'Retry publication' : 'Publish Talk'),
          ),
          if (_audio != null || _attempted || _receipt != null)
            TextButton(
              key: const ValueKey('talk-discard'),
              onPressed: _sending || _saving || _restoring || _checkingStatus ? null : _discard,
              child: Text(_receipt != null ? 'New Talk' : 'Discard draft'),
            ),
        ],
      )),
  );
