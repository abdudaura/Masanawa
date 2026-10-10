import 'dart:math';
import 'package:flutter/material.dart';
import 'audio_post_transport.dart';

/// AF05 must provide a server-verified uploaded asset; the Gateway independently
/// rechecks ownership, codec, size and duration on every publish operation.
class VerifiedPostAudio {
  const VerifiedPostAudio({required this.assetId, required this.durationMs});
  final String assetId;
  final int durationMs;
  bool get isPlausible => RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$').hasMatch(assetId)
      && durationMs >= 1000 && durationMs <= 180000;
}

typedef AcquireVerifiedPostAudio = Future<VerifiedPostAudio?> Function();
enum AudioCaptureFailure { permission, offline, tooLong, unavailable, other }
class AudioCaptureException implements Exception {
  const AudioCaptureException(this.reason);
  final AudioCaptureFailure reason;
}

/// AF09 composer. AF00 mounts it from Talks and injects AF05 verified media.
class AudioPostComposerScreen extends StatefulWidget {
  const AudioPostComposerScreen({
    super.key, required this.transport, required this.accountId,
    required this.isCurrentAccount, this.acquireVerifiedAudio,
    this.onPublished, this.newRequestId,
  });
  final AudioPostTransport transport;
  final String accountId;
  final bool Function(String) isCurrentAccount;
  final AcquireVerifiedPostAudio? acquireVerifiedAudio;
  final ValueChanged<AudioPost>? onPublished;
  final String Function()? newRequestId;
  @override
  State<AudioPostComposerScreen> createState() => _ComposerState();
}

class _ComposerState extends State<AudioPostComposerScreen> {
  final _title = TextEditingController();
  VerifiedPostAudio? _audio;
  AudioPost? _receipt;
  String? _requestId, _message;
  bool _acquiring = false, _sending = false, _attempted = false;
  int _generation = 0;
  bool get _authorized => widget.accountId.trim().isNotEmpty &&
      widget.isCurrentAccount(widget.accountId);
  bool get _validTitle {
    final t = _title.text.trim();
    return t.isNotEmpty && t.length <= 100 &&
        !RegExp(r'[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]').hasMatch(t);
  }
  bool get _canPublish => _authorized && _audio?.isPlausible == true &&
      _validTitle && !_acquiring && !_sending && _receipt == null;
  String _makeKey() => widget.newRequestId?.call() ?? (
    'talk-' + DateTime.now().microsecondsSinceEpoch.toRadixString(36) +
    '-' + Random.secure().nextInt(0x7fffffff).toRadixString(36)
  );

  @override
  void initState() {
    super.initState();
    _title.addListener(_refresh);
  }
  void _refresh() { if (mounted) setState(() {}); }
  void _clear() {
    ++_generation;
    _audio = null; _receipt = null; _requestId = null; _message = null;
    _attempted = false; _acquiring = false; _sending = false;
    _title.clear();
  }
  @override
  void didUpdateWidget(covariant AudioPostComposerScreen old) {
    super.didUpdateWidget(old);
    if (old.accountId != widget.accountId || old.transport != widget.transport) {
      setState(_clear);
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
    if (!_authorized || _acquiring || _attempted || widget.acquireVerifiedAudio == null) return;
    final generation = ++_generation;
    setState(() { _acquiring = true; _message = null; });
    try {
      final next = await widget.acquireVerifiedAudio!();
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
    setState(() { _sending = true; _attempted = true; _message = null; });
    try {
      final post = await widget.transport.publish(
        requestId: requestId, assetId: assetId, title: title,
      );
      if (!mounted || !_authorized || generation != _generation) return;
      if ((post.status != 'processing' && post.status != 'published') ||
          post.title != title) throw const FormatException('Invalid publish receipt');
      setState(() => _receipt = post);
      widget.onPublished?.call(post);
    } catch (_) {
      if (mounted && _authorized && generation == _generation) {
        setState(() => _message =
            'Publication is unconfirmed. Retry uses the same request ID.');
      }
    } finally {
      if (mounted && generation == _generation) setState(() => _sending = false);
    }
  }
  Future<void> _discard() async {
    if (_sending) return;
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
      if (yes != true || !mounted || !_authorized) return;
    }
    if (mounted) setState(_clear);
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
            onPressed: widget.acquireVerifiedAudio == null || _attempted ||
                _acquiring || _sending || _receipt != null ? null : _record,
            icon: const Icon(Icons.mic_outlined),
            label: Text(_acquiring ? 'Preparing audio…' :
                _audio == null ? 'Record audio' : 'Replace recording'),
          ),
          if (widget.acquireVerifiedAudio == null)
            const Text('Recording and verified upload are not configured in this build.'),
          if (_audio != null)
            Text('Verified audio: ' + (_audio!.durationMs / 1000).ceil().toString() + ' seconds'),
          const SizedBox(height: 14),
          TextField(
            key: const ValueKey('talk-title'),
            controller: _title,
            maxLength: 100,
            maxLines: 2,
            readOnly: _attempted || _sending || _receipt != null,
            decoration: const InputDecoration(
              labelText: 'Title', border: OutlineInputBorder(),
              hintText: 'What is this audio Talk about?',
            ),
          ),
          if (_message != null)
            Text(_message!, key: const ValueKey('talk-error')),
          if (_receipt != null)
            Text(_receipt!.status == 'published' ? 'Talk published.' :
              'Talk received; it is processing and is not public yet.',
              key: const ValueKey('talk-receipt')),
          const SizedBox(height: 14),
          FilledButton.icon(
            key: const ValueKey('talk-publish'),
            onPressed: _canPublish ? _publish : null,
            icon: _sending ? const SizedBox(
              width: 16, height: 16,
              child: CircularProgressIndicator(strokeWidth: 2)) :
              const Icon(Icons.publish_outlined),
            label: Text(_sending ? 'Submitting…' :
                _attempted ? 'Retry publication' : 'Publish Talk'),
          ),
          if (_audio != null || _attempted || _receipt != null)
            TextButton(
              key: const ValueKey('talk-discard'),
              onPressed: _sending ? null : _discard,
              child: Text(_receipt != null ? 'New Talk' : 'Discard draft'),
            ),
        ],
      )),
  );
