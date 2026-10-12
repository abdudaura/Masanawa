import 'dart:async';
import 'dart:collection';
import 'dart:typed_data';
import 'package:audio_session/audio_session.dart';
import 'package:record/record.dart';
import '../core/live_pcm_audio.dart';

abstract interface class GroupMicrophone {
  Future<Stream<Uint8List>> start(void Function() onInterrupted);
  Future<void> close();
}

class NativeGroupMicrophone implements GroupMicrophone {
  final AudioRecorder _recorder = AudioRecorder();
  AudioSession? _session;
  StreamSubscription<AudioInterruptionEvent>? _interruptions;
  StreamSubscription<void>? _noisy;
  bool _closed = false;
  Future<Stream<Uint8List>>? _starting;
  Future<void>? _closing;
  @override
  Future<Stream<Uint8List>> start(void Function() onInterrupted) {
    if (_closed) return Future.error(StateError('Microphone is closed.'));
    return _starting ??= _start(onInterrupted);
  }

  Future<Stream<Uint8List>> _start(void Function() onInterrupted) async {
    if (_closed) throw StateError('Microphone is closed.');
    if (!await _recorder.hasPermission()) {
      throw StateError('Microphone permission is required.');
    }
    if (_closed) throw StateError('Call ended.');
    final session = await AudioSession.instance;
    if (_closed) throw StateError('Call ended.');
    _session = session;
    await session.configure(
      AudioSessionConfiguration(
        avAudioSessionCategory: AVAudioSessionCategory.playAndRecord,
        avAudioSessionCategoryOptions:
            AVAudioSessionCategoryOptions.allowBluetooth |
            AVAudioSessionCategoryOptions.defaultToSpeaker,
        avAudioSessionMode: AVAudioSessionMode.voiceChat,
        androidAudioAttributes: const AndroidAudioAttributes(
          contentType: AndroidAudioContentType.speech,
          usage: AndroidAudioUsage.voiceCommunication,
        ),
        androidAudioFocusGainType: AndroidAudioFocusGainType.gain,
        androidWillPauseWhenDucked: true,
      ),
    );
    if (_closed) throw StateError('Call ended.');
    if (!await session.setActive(true)) {
      throw StateError('Audio is in use. End the other call first.');
    }
    if (_closed) {
      await session.setActive(false);
      throw StateError('Call ended.');
    }
    _interruptions = session.interruptionEventStream.listen((event) {
      if (event.begin) onInterrupted();
    });
    _noisy = session.becomingNoisyEventStream.listen((_) => onInterrupted());
    if (!await LivePcmAudio.setSpeaker(true)) {
      throw StateError('Native audio routing is unavailable.');
    }
    if (_closed) throw StateError('Call ended.');
    final input = await _recorder.startStream(
      const RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: 16000,
        numChannels: 1,
        echoCancel: true,
        noiseSuppress: true,
        autoGain: true,
      ),
    );
    if (_closed) {
      await _recorder.stop();
      throw StateError('Call ended.');
    }
    return input.asBroadcastStream();
  }

  @override
  Future<void> close() {
    if (_closing != null) return _closing!;
    _closed = true;
    return _closing = _close();
  }

  Future<void> _close() async {
    // Restore focus immediately even if permission/stream setup is pending.
    try {
      await _interruptions?.cancel();
    } catch (_) {}
    try {
      await _noisy?.cancel();
    } catch (_) {}
    try {
      await LivePcmAudio.release();
    } catch (_) {}
    try {
      await _session?.setActive(false);
    } catch (_) {}
    try {
      await _recorder.stop();
    } catch (_) {}
    // Never dispose a recorder concurrently with its in-flight startStream.
    // _start checks _closed after every native await and stops late capture.
    try {
      await _starting;
    } catch (_) {}
    try {
      await _recorder.stop();
    } catch (_) {}
    try {
      await _recorder.dispose();
    } catch (_) {}
    try {
      await _session?.setActive(false);
    } catch (_) {}
  }
}

abstract interface class GroupPcmPlayer {
  Future<void> write(Uint8List bytes);
  Future<void> stop();
}

class NativeGroupPcmPlayer implements GroupPcmPlayer {
  @override
  Future<void> write(Uint8List bytes) async {
    if (!await LivePcmAudio.start(sampleRate: 24000) ||
        !await LivePcmAudio.write(bytes)) {
      throw StateError('Native audio playback is unavailable.');
    }
  }

  @override
  Future<void> stop() => LivePcmAudio.stop();
}

/// Holds one speaker's turn; only human microphone frames feed model inputs.
/// PCM is paced at 24 kHz and the aggregate waiting buffer is bounded.
class GroupPlaybackCoordinator {
  GroupPlaybackCoordinator({
    required this.player,
    required this.onFailure,
    this.maxQueuedBytes = 24000 * 2 * 6,
    Future<void> Function(Duration)? wait,
  }) : _wait = wait ?? Future<void>.delayed;
  final GroupPcmPlayer player;
  final void Function(Object) onFailure;
  final int maxQueuedBytes;
  final Future<void> Function(Duration) _wait;
  final Map<String, Queue<Uint8List>> _queues = {};
  final Set<String> _removed = {}, _finished = {};
  String? _speaker;
  bool _draining = false, _closed = false;
  int _queuedBytes = 0, _epoch = 0;
  Timer? _turnTimeout;
  int get queuedBytes => _queuedBytes;
  String? get speaker => _speaker;
  void add(String id, Uint8List bytes) {
    if (_closed ||
        _removed.contains(id) ||
        bytes.isEmpty ||
        bytes.length.isOdd ||
        bytes.length > maxQueuedBytes ||
        _queuedBytes + bytes.length > maxQueuedBytes) {
      return;
    }
    _finished.remove(id);
    (_queues[id] ??= Queue<Uint8List>()).add(Uint8List.fromList(bytes));
    _queuedBytes += bytes.length;
    _speaker ??= id;
    _turnTimeout ??= Timer(const Duration(seconds: 15), () {
      final active = _speaker;
      if (active != null) unawaited(interrupt(active));
    });
    unawaited(_drain());
  }

  void turnComplete(String id) {
    _finished.add(id);
    unawaited(_drain());
  }

  Future<void> remove(String id) async {
    _removed.add(id);
    await interrupt(id);
  }

  Future<void> interrupt(String id) async {
    final queue = _queues.remove(id);
    if (queue != null) {
      for (final bytes in queue) {
        _queuedBytes -= bytes.length;
      }
    }
    _finished.remove(id);
    if (_speaker == id) {
      _epoch++;
      _speaker = null;
      _turnTimeout?.cancel();
      _turnTimeout = null;
      await player.stop();
    }
    unawaited(_drain());
  }

  Future<void> _drain() async {
    if (_draining || _closed) return;
    _draining = true;
    try {
      while (!_closed) {
        _speaker ??= _queues.keys
            .where((id) => _queues[id]!.isNotEmpty && !_removed.contains(id))
            .firstOrNull;
        final id = _speaker;
        if (id == null) break;
        _turnTimeout ??= Timer(
          const Duration(seconds: 15),
          () => unawaited(interrupt(id)),
        );
        final queue = _queues[id];
        if (queue == null || queue.isEmpty) {
          if (!_finished.remove(id)) break;
          _queues.remove(id);
          _speaker = null;
          _turnTimeout?.cancel();
          _turnTimeout = null;
          continue;
        }
        final bytes = queue.removeFirst();
        _queuedBytes -= bytes.length;
        final epoch = _epoch;
        await player.write(bytes);
        if (_closed || epoch != _epoch) {
          await player.stop();
          continue;
        }
        await _wait(
          Duration(microseconds: (bytes.length * 1000000 / 48000).ceil()),
        );
      }
    } catch (error) {
      onFailure(error);
    } finally {
      _draining = false;
    }
  }

  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    _epoch++;
    _turnTimeout?.cancel();
    _queues.clear();
    _queuedBytes = 0;
    _speaker = null;
    await player.stop();
  }
}
