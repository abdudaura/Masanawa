import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import 'audio_post_media_contract.dart';

/// The AF05/AF15 binding must upload privately, trim server-side and return
/// only a verified owned-ready media receipt. This screen cannot mint asset IDs.
typedef UploadVerifiedTalkAudio = Future<VerifiedPostAudio> Function({
  required String localPath,
  required int startMs,
  required int endMs,
});

abstract class TalkCaptureRecorder {
  Future<bool> hasPermission();
  Future<void> start(String path);
  Future<void> pause();
  Future<void> resume();
  Future<String?> stop();
  Future<void> close();
}

class DeviceTalkCaptureRecorder implements TalkCaptureRecorder {
  final AudioRecorder _native = AudioRecorder();
  @override
  Future<bool> hasPermission() => _native.hasPermission();
  @override
  Future<void> start(String path) => _native.start(
    const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 96000),
    path: path,
  );
  @override
  Future<void> pause() => _native.pause();
  @override
  Future<void> resume() => _native.resume();
  @override
  Future<String?> stop() => _native.stop();
  @override
  Future<void> close() => _native.dispose();
}

abstract class TalkCapturePlayer {
  Future<void> preview(String path, int startMs, int endMs);
  Future<void> stop();
  Future<void> close();
}

class DeviceTalkCapturePlayer implements TalkCapturePlayer {
  final AudioPlayer _native = AudioPlayer();
  @override
  Future<void> preview(String path, int startMs, int endMs) async {
    await _native.setFilePath(path);
    await _native.setClip(
      start: Duration(milliseconds: startMs),
      end: Duration(milliseconds: endMs),
    );
    // just_audio.play completes at the end of playback, not on its start.
    unawaited(_native.play());
  }
  @override
  Future<void> stop() => _native.stop();
  @override
  Future<void> close() => _native.dispose();
}

/// AF00 can inject this flow into the existing composer callback. Returning
/// null means cancel/failure, never a fabricated successful media upload.
Future<VerifiedPostAudio?> showTalkCaptureSheet(
  BuildContext context, {
  required String accountId,
  required bool Function(String) isCurrentAccount,
  required UploadVerifiedTalkAudio? upload,
}) => showModalBottomSheet<VerifiedPostAudio>(
  context: context, isScrollControlled: true, useSafeArea: true,
  builder: (_) => TalkCaptureSheet(
    accountId: accountId, isCurrentAccount: isCurrentAccount, upload: upload),
);

class TalkCaptureSheet extends StatefulWidget {
  const TalkCaptureSheet({
    super.key, required this.accountId, required this.isCurrentAccount,
    required this.upload, this.recorder, this.player, this.tempDirectory,
  });
  final String accountId;
  final bool Function(String) isCurrentAccount;
  final UploadVerifiedTalkAudio? upload;
  final TalkCaptureRecorder? recorder;
  final TalkCapturePlayer? player;
  final Future<Directory> Function()? tempDirectory;
  @override
  State<TalkCaptureSheet> createState() => _TalkCaptureSheetState();
}

enum _Stage { idle, recording, paused, preview, uploading }

class _TalkCaptureSheetState extends State<TalkCaptureSheet> {
  TalkCaptureRecorder? _recInstance;
  TalkCapturePlayer? _playerInstance;
  TalkCaptureRecorder get _rec => _recInstance ??=
      widget.recorder ?? DeviceTalkCaptureRecorder();
  TalkCapturePlayer get _player => _playerInstance ??=
      widget.player ?? DeviceTalkCapturePlayer();
  _Stage _stage = _Stage.idle;
  Stopwatch? _clock;
  Timer? _ticker;
  String? _path, _error;
  int _duration = 0, _start = 0, _end = 0, _generation = 0;
  bool _busy = false;
  bool get _authorized => widget.accountId.isNotEmpty &&
      widget.isCurrentAccount(widget.accountId);
  int get _elapsed => (_clock?.elapsedMilliseconds ?? _duration).clamp(0, 180000).toInt();
  bool get _validTrim => _end - _start >= 1000 && _end <= _duration;

  @override
  void didUpdateWidget(covariant TalkCaptureSheet old) {
    super.didUpdateWidget(old);
    if (old.accountId != widget.accountId ||
        old.isCurrentAccount != widget.isCurrentAccount) {
      ++_generation;
      unawaited(_discard());
    }
  }

  Future<void> _delete(String? path) async {
    if (path == null) return;
    try {
      final file = File(path);
      if (await file.exists()) await file.delete();
    } catch (_) { /* App-private temp files remain OS cache-evictable. */ }
  }

  Future<void> _startRecord() async {
    if (_busy || !_authorized || _stage != _Stage.idle) return;
    final generation = ++_generation;
    setState(() { _busy = true; _error = null; });
    String? candidate;
    try {
      if (!await _rec.hasPermission()) {
        if (mounted) setState(() => _error = 'Microphone permission is required.');
        return;
      }
      if (!mounted || generation != _generation || !_authorized) return;
      final directory = await (widget.tempDirectory?.call() ?? getTemporaryDirectory());
      candidate = directory.path + '/talk-' +
          DateTime.now().microsecondsSinceEpoch.toString() + '-' +
          Random.secure().nextInt(0x7fffffff).toString() + '.m4a';
      await _rec.start(candidate);
      if (!mounted || generation != _generation || !_authorized) {
        await _rec.stop();
        await _delete(candidate);
        return;
      }
      _path = candidate;
      _clock = Stopwatch()..start();
      _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) {
        if (!mounted) return;
        if (!_authorized || _elapsed >= 180000) {
          unawaited(_stopRecord());
        } else { setState(() {}); }
      });
      setState(() => _stage = _Stage.recording);
    } catch (_) {
      await _delete(candidate);
      if (mounted) setState(() => _error = 'Cannot start recording. Check microphone access.');
    } finally {
      if (mounted && generation == _generation) setState(() => _busy = false);
    }
  }

  Future<void> _pauseResume() async {
    if (_busy || !_authorized) return;
    if (_stage != _Stage.recording && _stage != _Stage.paused) return;
    setState(() => _busy = true);
    try {
      if (_stage == _Stage.recording) {
        await _rec.pause();
        _clock?.stop();
        if (mounted) setState(() => _stage = _Stage.paused);
      } else {
        await _rec.resume();
        _clock?.start();
        if (mounted) setState(() => _stage = _Stage.recording);
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Pause or resume failed. Stop or discard.');
    } finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _stopRecord() async {
    if (_busy || (_stage != _Stage.recording && _stage != _Stage.paused)) return;
    setState(() => _busy = true);
    _ticker?.cancel();
    _clock?.stop();
    final elapsed = _elapsed;
    try {
      final actual = await _rec.stop();
      if (!mounted || !_authorized) {
        await _delete(actual ?? _path);
        return;
      }
      if (actual == null || !await File(actual).exists() || elapsed < 1000) {
        await _delete(actual ?? _path);
        setState(() {
          _path = null; _stage = _Stage.idle;
          _error = 'Record at least one second and try again.';
        });
        return;
      }
      setState(() {
        _path = actual;
        _duration = elapsed;
        _start = 0; _end = elapsed;
        _stage = _Stage.preview;
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Cannot finish recording. Discard and retry.');
    } finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _preview() async {
    if (!_authorized || _busy || _stage != _Stage.preview ||
        _path == null || !_validTrim) return;
    try {
      await _player.stop();
      await _player.preview(_path!, _start, _end);
    } catch (_) {
      if (mounted) setState(() => _error = 'Preview unavailable. Retry or discard.');
    }
  }

  Future<void> _upload() async {
    final path = _path, upload = widget.upload;
    if (_busy || !_authorized || !_validTrim || path == null ||
        upload == null || _stage != _Stage.preview) return;
    final generation = ++_generation;
    setState(() { _busy = true; _stage = _Stage.uploading; _error = null; });
    try {
      await _player.stop();
      final verified = await upload(localPath: path, startMs: _start, endMs: _end);
      if (!mounted || generation != _generation || !_authorized) return;
      if (!verified.isPlausible ||
          (verified.durationMs - (_end - _start)).abs() > 1000) {
        throw StateError('Invalid private media receipt');
      }
      await _delete(path);
      _path = null;
      if (mounted) Navigator.of(context).pop(verified);
    } catch (_) {
      if (mounted && generation == _generation) {
        setState(() {
          _stage = _Stage.preview;
          _error = 'Private upload not confirmed. Retry without recording again.';
        });
      }
    } finally { if (mounted && generation == _generation) setState(() => _busy = false); }
  }

  Future<void> _discard() async {
    _ticker?.cancel();
    _clock?.stop();
    if (_playerInstance != null) {
      try { await _playerInstance!.stop(); } catch (_) {}
    }
    if (_stage == _Stage.recording || _stage == _Stage.paused) {
      try { await _rec.stop(); } catch (_) {}
    }
    final path = _path;
    _path = null;
    await _delete(path);
    if (mounted) {
      setState(() {
        _stage = _Stage.idle; _duration = 0;
        _start = 0; _end = 0; _busy = false; _error = null;
      });
    }
  }

  @override
  void dispose() {
    ++_generation;
    _ticker?.cancel();
    _clock?.stop();
    final path = _path;
    _path = null;
    unawaited(() async {
      if (_recInstance != null) {
        try { await _recInstance!.stop(); } catch (_) {}
      }
      if (_playerInstance != null) {
        try { await _playerInstance!.stop(); } catch (_) {}
      }
      await _delete(path);
      if (_recInstance != null) {
        try { await _recInstance!.close(); } catch (_) {}
      }
      if (_playerInstance != null) {
        try { await _playerInstance!.close(); } catch (_) {}
      }
    }());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final disabled = _busy || !_authorized;
    final duration = (_stage == _Stage.recording || _stage == _Stage.paused)
        ? _elapsed : _duration;
    return Padding(
      padding: EdgeInsets.fromLTRB(
          20, 16, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Record a Talk', style: TextStyle(fontSize: 20)),
          Text((duration / 1000).toStringAsFixed(1) + ' / 180 seconds'),
          if (!_authorized)
            const Text('Account changed. Discard this recording and reopen Talks.'),
          if (_stage == _Stage.idle)
            FilledButton.icon(
              onPressed: disabled ? null : _startRecord,
              icon: const Icon(Icons.mic), label: const Text('Record')),
          if (_stage == _Stage.recording || _stage == _Stage.paused)
            Row(children: [
              Expanded(child: OutlinedButton(
                onPressed: disabled ? null : _pauseResume,
                child: Text(_stage == _Stage.paused ? 'Resume' : 'Pause'))),
              Expanded(child: FilledButton(
                onPressed: disabled ? null : _stopRecord,
                child: const Text('Stop'))),
            ]),
          if (_stage == _Stage.preview || _stage == _Stage.uploading) ...[
            const Text('Trim your recording (at least one second)'),
            Text('Start ' + (_start / 1000).toStringAsFixed(1) + 's'),
            Slider(
              value: _start.toDouble(),
              min: 0, max: max(1, _duration).toDouble(),
              onChanged: disabled ? null : (value) {
                if (value.round() + 1000 > _end) return;
                setState(() => _start = value.round());
                unawaited(_player.stop());
              }),
            Text('End ' + (_end / 1000).toStringAsFixed(1) + 's'),
            Slider(
              value: _end.toDouble(),
              min: 0, max: max(1, _duration).toDouble(),
              onChanged: disabled ? null : (value) {
                if (value.round() - _start < 1000) return;
                setState(() => _end = value.round());
                unawaited(_player.stop());
              }),
            OutlinedButton.icon(
              onPressed: disabled || !_validTrim ? null : _preview,
              icon: const Icon(Icons.play_arrow),
              label: const Text('Preview selection')),
            if (widget.upload == null)
              const Text('Private upload unavailable; this recording cannot be published.'),
            FilledButton(
              onPressed: disabled || !_validTrim || widget.upload == null ? null : _upload,
              child: Text(_stage == _Stage.uploading ? 'Verifying private upload…' : 'Use recording')),
          ],
          if (_error != null)
            Text(_error!, key: const Key('capture-error'),
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
          TextButton(
            onPressed: _busy ? null : () async {
              await _discard();
              if (context.mounted) Navigator.of(context).pop();
            }, child: const Text('Discard and close')),
        ],
      ),
    );
  }
}
