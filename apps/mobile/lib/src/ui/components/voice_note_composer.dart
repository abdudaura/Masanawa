import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_permissions.dart';
import '../../core/audio_failure.dart';
import '../../core/voice_note_recorder.dart';
import '../../state/ai_chat_state.dart';
import '../../theme/masanawa_theme.dart';

final voiceNoteRecorderFactoryProvider = Provider<VoiceNoteRecorder Function()>((ref) => () => VoiceNoteRecorder());

/// Explicit recording/stop/send controls; tapping a voice note never buys or
/// starts a live call. The parent owns the authenticated send boundary.
class VoiceNoteComposer extends StatefulWidget {
  const VoiceNoteComposer({super.key, required this.recorder,
    required this.isOwnerCurrent, required this.onSend});
  final VoiceNoteRecorder recorder;
  final bool Function() isOwnerCurrent;
  final Future<bool> Function(ChatAttachment) onSend;
  @override State<VoiceNoteComposer> createState() => _VoiceNoteComposerState();
}

class _VoiceNoteComposerState extends State<VoiceNoteComposer> {
  bool _sending = false;
  String? _error;
  @override void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(widget.recorder.start(isOwnerCurrent: widget.isOwnerCurrent));
    });
  }

  Future<void> _send() async {
    if (_sending) return;
    if (!widget.isOwnerCurrent()) {
      await widget.recorder.cancel();
      if (mounted) setState(() => _error = 'The account changed. Record a new voice note.');
      return;
    }
    setState(() { _sending = true; _error = null; });
    try {
      final note = await widget.recorder.stop();
      if (note == null || !mounted || !widget.isOwnerCurrent()) return;
      if (!await widget.onSend(note)) {
        if (mounted) setState(() => _error = 'Wait for the current reply, then send this recording.');
        return;
      }
      widget.recorder.retain();
      if (mounted) Navigator.of(context).pop();
    } catch (failure) {
      if (mounted) setState(() => _error = audioFailureMessage(failure, fallback: 'The voice note could not be sent. Please try again.'));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _cancel() async {
    await widget.recorder.cancel();
    if (mounted) Navigator.of(context).pop();
  }

  @override Widget build(BuildContext context) {
    final colors = context.masanawa;
    return SafeArea(child: SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
      child: AnimatedBuilder(animation: widget.recorder, builder: (context, _) {
        final recorder = widget.recorder;
        final recording = recorder.state == VoiceNoteState.recording;
        final ready = recorder.state == VoiceNoteState.ready;
        final busy = _sending || recorder.state == VoiceNoteState.starting || recorder.state == VoiceNoteState.stopping;
        final seconds = recorder.elapsed.inSeconds;
        final message = _error ?? recorder.error;
        return Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.mic, size: 36, color: recording ? colors.emergency : colors.brandStrong),
          const SizedBox(height: 12),
          Text(recording ? 'Recording voice note' : ready ? 'Voice note ready' : busy ? 'Starting recording…' : 'Voice note',
            textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text('${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}',
            style: TextStyle(color: colors.textPrimary, fontSize: 24)),
          if (message != null) Padding(padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(message, textAlign: TextAlign.center)),
          if (busy) const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()),
          const SizedBox(height: 16),
          Wrap(alignment: WrapAlignment.center, spacing: 12, runSpacing: 8, children: [
            TextButton(onPressed: _sending ? null : _cancel, child: const Text('Cancel')),
            if (recording) OutlinedButton(onPressed: busy ? null : () => unawaited(recorder.stop()), child: const Text('Stop')),
            if (recording || ready) FilledButton.icon(
              onPressed: busy ? null : _send, icon: const Icon(Icons.send), label: const Text('Send voice note')),
            if (!recording && !ready && !busy && widget.isOwnerCurrent())
              FilledButton(onPressed: () => recorder.start(isOwnerCurrent: widget.isOwnerCurrent), child: const Text('Record again')),
            if (recorder.error?.contains('permission') == true)
              TextButton(onPressed: AppPermissions.openSettings, child: const Text('Microphone settings')),
          ]),
        ]);
      }),
    ));
  }
}
