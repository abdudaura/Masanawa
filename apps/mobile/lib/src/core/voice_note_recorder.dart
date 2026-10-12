import 'dart:async';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../state/ai_chat_state.dart';
import 'audio_failure.dart';
import 'request_id.dart';

enum VoiceNoteState { idle, starting, recording, stopping, ready, failed, closed }

/// Local recording only. The existing authenticated chat transport owns send,
/// offline queue/retry and resulting message receipts.
class VoiceNoteRecorder extends ChangeNotifier with WidgetsBindingObserver {
  VoiceNoteRecorder({AudioRecorder? recorder, Future<Directory> Function()? directory})
      : _recorder = recorder ?? AudioRecorder(),
        _directory = directory ?? getApplicationSupportDirectory;

  final AudioRecorder _recorder;
  final Future<Directory> Function() _directory;
  VoiceNoteState state = VoiceNoteState.idle;
  String? error;
  ChatAttachment? note;
  final Stopwatch _clock = Stopwatch();
  Duration get elapsed => _clock.elapsed;
  String? _path;
  Timer? _timer;
  int _generation = 0;
  Future<void>? _opening;
  Future<ChatAttachment?>? _stopping;
  Future<void>? _closing;
  bool _retained = false;
  bool _observing = false;
  bool Function() _isOwnerCurrent = () => true;

  Future<void> start({bool Function()? isOwnerCurrent}) async {
    if (state != VoiceNoteState.idle && state != VoiceNoteState.failed) return;
    _isOwnerCurrent = isOwnerCurrent ?? () => true;
    if (!_isOwnerCurrent()) return;
    final generation = ++_generation;
    _set(VoiceNoteState.starting);
    final opening = _start(generation);
    _opening = opening;
    try { await opening; } finally { _opening = null; }
  }

  bool _current(int generation) => generation == _generation && _closing == null && _isOwnerCurrent();

  Future<void> _start(int generation) async {
    try {
      if (!await _recorder.hasPermission()) {
        throw const AudioFailure('permission', 'Microphone permission was denied. Allow microphone access in Android settings to record.');
      }
      if (!_current(generation)) { _set(VoiceNoteState.idle); return; }
      final directory = await _directory();
      if (!_current(generation)) { _set(VoiceNoteState.idle); return; }
      final folder = Directory('${directory.path}/voice_notes');
      await folder.create(recursive: true);
      if (!_current(generation)) { _set(VoiceNoteState.idle); return; }
      _path = '${folder.path}/${createRequestId()}.m4a';
      await _recorder.start(const RecordConfig(
        encoder: AudioEncoder.aacLc, bitRate: 64000, sampleRate: 16000, numChannels: 1,
      ), path: _path!);
      if (!_current(generation)) { await _discard(); _set(VoiceNoteState.idle); return; }
      _clock.reset(); _clock.start();
      WidgetsBinding.instance.addObserver(this); _observing = true;
      _set(VoiceNoteState.recording);
      _timer = Timer.periodic(const Duration(milliseconds: 250), (_) {
        if (!_isOwnerCurrent()) { unawaited(cancel()); return; }
        if (elapsed >= const Duration(minutes: 5)) { unawaited(stop()); return; }
        notifyListeners();
      });
    } catch (failure) {
      await _discard();
      if (generation != _generation || _closing != null) return;
      error = audioFailureMessage(failure, fallback: 'Recording could not start. Another app may be using audio. Close it and try again.');
      _set(VoiceNoteState.failed, clearError: false);
    }
  }

  Future<ChatAttachment?> stop() async {
    if (_stopping != null) return _stopping!;
    if (state == VoiceNoteState.ready) return note;
    if (state != VoiceNoteState.recording) return null;
    final generation = _generation;
    _stopClock();
    _set(VoiceNoteState.stopping);
    final stopping = _stop(generation);
    _stopping = stopping;
    try { return await stopping; } finally { _stopping = null; }
  }

  Future<ChatAttachment?> _stop(int generation) async {
    try {
      final path = await _recorder.stop();
      if (!_current(generation)) { await _deleteFile(); return null; }
      if (path == null || path != _path) {
        throw const AudioFailure('empty', 'No audio was recorded. Please record again.');
      }
      final bytes = await File(path).length();
      if (!_current(generation)) { await _deleteFile(); return null; }
      if (bytes == 0 || bytes > 8 * 1024 * 1024) {
        throw const AudioFailure('size', 'The recording is empty or too large. Please record again.');
      }
      note = ChatAttachment(kind: 'voice', path: path, name: 'Voice note.m4a',
          durationMs: elapsed.inMilliseconds, sizeBytes: bytes);
      _set(VoiceNoteState.ready);
      return note;
    } catch (failure) {
      await _deleteFile();
      if (generation != _generation || _closing != null) return null;
      error = audioFailureMessage(failure, fallback: 'The recording could not be saved. Please record again.');
      _set(VoiceNoteState.failed, clearError: false);
      return null;
    }
  }

  /// Called only after the current account has explicitly submitted the note.
  void retain() {
    if (state != VoiceNoteState.ready || !_isOwnerCurrent()) {
      throw const AudioFailure('account', 'This recording belongs to a previous session.');
    }
    _retained = true;
  }

  Future<void> cancel() async {
    if (state == VoiceNoteState.closed) return;
    ++_generation;
    _stopClock();
    await _opening;
    await _stopping;
    await _discard();
    note = null;
    _set(VoiceNoteState.idle);
  }

  void _stopClock() {
    _timer?.cancel(); _timer = null; _clock.stop();
    if (_observing) { WidgetsBinding.instance.removeObserver(this); _observing = false; }
  }

  Future<void> _discard() async {
    if (!_retained) { try { await _recorder.cancel(); } catch (_) {} }
    await _deleteFile();
  }

  Future<void> _deleteFile() async {
    final path = _path;
    if (path == null || _retained) return;
    _path = null;
    try { await File(path).delete(); } on FileSystemException { /* Already removed. */ }
  }

  Future<void> close() => _closing ??= _close();
  Future<void> _close() async {
    await cancel();
    await _recorder.dispose();
    _set(VoiceNoteState.closed);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      unawaited(cancel());
    }
  }

  void _set(VoiceNoteState value, {bool clearError = true}) {
    state = value;
    if (clearError) error = null;
    notifyListeners();
  }
}
