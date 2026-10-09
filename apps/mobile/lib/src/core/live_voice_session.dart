import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:audio_session/audio_session.dart';
import 'package:record/record.dart';
import 'package:flutter/widgets.dart';

import '../agents/agent_shell.dart';
import 'live_pcm_audio.dart';

enum LiveVoiceState {
  idle,
  connecting,
  listening,
  speaking,
  interrupted,
  ended,
  failed,
}

/// Machine-readable stage for recovery guidance; existing [errors] strings remain.
enum LiveVoiceFailureStage {
  permission,
  focus,
  signaling,
  capture,
  playback,
  transport,
  interruption,
}

class LiveVoiceFailure {
  const LiveVoiceFailure(this.stage, this.message);

  final LiveVoiceFailureStage stage;
  final String message;
}

class _LiveVoiceFault implements Exception {
  const _LiveVoiceFault(this.stage, this.message);

  final LiveVoiceFailureStage stage;
  final String message;
}

class LiveVoiceSession with WidgetsBindingObserver {
  LiveVoiceSession({
    required this.grant,
    required this.characterName,
    this.captureInputTranscription = false,
    AudioRecorder? recorder,
  }) : _recorder = recorder ?? AudioRecorder() {
    // Closing before a caller awaits readiness must not emit an unhandled
    // async error. Consumers awaiting ready still receive the failure.
    _ready.future.ignore();
  }

  final AgentLiveVoiceGrant grant;
  final String characterName;
  final bool captureInputTranscription;
  final AudioRecorder _recorder;
  final _state = StreamController<LiveVoiceState>.broadcast(sync: true);
  final _errors = StreamController<String>.broadcast(sync: true);
  final _failures = StreamController<LiveVoiceFailure>.broadcast(sync: true);
  final _transcripts = StreamController<String>.broadcast(sync: true);
  final _inputTranscripts = StreamController<String>.broadcast(sync: true);
  final _turnCompletions = StreamController<void>.broadcast(sync: true);
  final Completer<void> _ready = Completer<void>();
  WebSocket? _socket;
  StreamSubscription<Uint8List>? _micSub;
  StreamSubscription<dynamic>? _socketSub;
  StreamSubscription<AudioInterruptionEvent>? _interruptions;
  StreamSubscription<void>? _noisy;
  Timer? _setupTimer;
  Future<void>? _starting;
  Future<void>? _closing;
  Future<void>? _startingMic;
  Future<void> _incoming = Future<void>.value();
  bool _closed = false;
  bool _setupComplete = false;
  bool _speaker = true;
  bool _muted = false;
  bool _observing = false;

  Stream<LiveVoiceState> get states => _state.stream;
  Stream<String> get errors => _errors.stream;
  Stream<LiveVoiceFailure> get failures => _failures.stream;
  Stream<String> get transcripts => _transcripts.stream;
  Stream<String> get inputTranscripts => _inputTranscripts.stream;
  Stream<void> get turnCompletions => _turnCompletions.stream;
  Future<void> get ready => _ready.future;
  bool get speakerEnabled => _speaker;
  bool get muted => _muted;

  Future<void> start() async {
    final active = _starting;
    if (active != null) return active;
    final future = _start();
    _starting = future;
    try {
      await future;
    } finally {
      _starting = null;
    }
  }

  Future<void> _start() async {
    if (_closed || _socket != null) return;
    _state.add(LiveVoiceState.connecting);
    try {
      bool microphoneGranted;
      try {
        microphoneGranted = await _recorder.hasPermission();
      } catch (_) {
        throw const _LiveVoiceFault(
          LiveVoiceFailureStage.permission,
          'Could not check microphone permission. Check app permissions and retry.',
        );
      }
      if (!microphoneGranted) {
        throw const _LiveVoiceFault(
          LiveVoiceFailureStage.permission,
          'Microphone permission is required for live voice.',
        );
      }
      if (_closed) return;
      late final AudioSession audioSession;
      try {
        audioSession = await AudioSession.instance;
        await audioSession.configure(
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
      if (_closed) return;
      if (!await audioSession.setActive(true)) {
        throw const _LiveVoiceFault(
          LiveVoiceFailureStage.focus,
          'Audio is in use. End the other call and try again.',
        );
      }
        if (_closed) {
          await audioSession.setActive(false);
          return;
        }
      } on _LiveVoiceFault {
        rethrow;
      } catch (_) {
        throw const _LiveVoiceFault(
          LiveVoiceFailureStage.focus,
          'Could not activate microphone audio. End another call and retry.',
        );
      }
      _interruptions = audioSession.interruptionEventStream.listen((event) {
        if (event.begin && !_closed) {
          _fail(
            'Live voice ended because another call needs the microphone.',
            stage: LiveVoiceFailureStage.interruption,
          );
          unawaited(close());
        }
      });
      _noisy = audioSession.becomingNoisyEventStream.listen((_) {
        if (!_closed) {
          _fail(
            'Live voice ended because the audio device disconnected.',
            stage: LiveVoiceFailureStage.interruption,
          );
          unawaited(close());
        }
      });
      WidgetsBinding.instance.addObserver(this);
      _observing = true;

      final socket = await WebSocket.connect(grant.websocketUrl)
          .then((socket) {
            if (_closed) unawaited(socket.close());
            return socket;
          })
          .timeout(const Duration(seconds: 20));
      if (_closed) {
        await socket.close();
        return;
      }
      _socket = socket;
      _socketSub = socket.listen(
        (raw) {
          // WebSocket.listen does not await async callbacks. Preserve PCM and
          // setup/interruption ordering across native method-channel awaits.
          _incoming = _incoming.then((_) => _handleServerMessage(raw));
        },
        onError: (Object error) {
          _fail(
            'Live voice connection failed.',
            stage: LiveVoiceFailureStage.transport,
          );
          unawaited(close());
        },
        onDone: () {
          if (!_closed) {
            _fail(
              'Live voice connection ended. Start a new call to reconnect.',
              stage: LiveVoiceFailureStage.transport,
            );
            unawaited(close());
          }
        },
        cancelOnError: false,
      );
      _setupTimer = Timer(const Duration(seconds: 20), () {
        if (!_closed && !_setupComplete) {
          _fail(
            'Live voice setup timed out. Try starting a new call.',
            stage: LiveVoiceFailureStage.signaling,
          );
          unawaited(close());
        }
      });
      socket.add(
        jsonEncode({
          'setup': {
            'model': 'models/${grant.model}',
            'generationConfig': {
              'responseModalities': ['AUDIO'],
              'speechConfig': {
                'voiceConfig': {
                  'prebuiltVoiceConfig': {'voiceName': grant.voiceName},
                },
              },
            },
            'outputAudioTranscription': {},
            if (captureInputTranscription) 'inputAudioTranscription': {},
            'systemInstruction': {
              'parts': [
                {
                  'text': captureInputTranscription
                      ? 'You are $characterName conducting a short voice-first Twin setup interview. '
                            'Ask one simple question at a time about greeting style, helpful behavior, '
                            'personality, useful knowledge, decisions and boundaries. Never ask for a '
                            'preferred language; always follow the language/register the user is speaking. '
                            'Do not read, quote or mention hidden transcription or internal setup state.'
                      : 'You are $characterName. Have a natural live voice conversation. '
                            'Answer in the user\'s language. Do not transcribe the user or '
                            'read hidden system information aloud.',
                },
              ],
            },
          },
        }),
      );
    } catch (error) {
      final failure = error is _LiveVoiceFault
          ? error
          : const _LiveVoiceFault(
              LiveVoiceFailureStage.transport,
              'Could not start live voice. Check your connection and retry.',
            );
      _fail(failure.message, stage: failure.stage);
      await close();
      throw StateError(failure.message);
    }
  }

  Future<void> _beginMicrophone() async {
    if (_closed || _muted || !_setupComplete || _micSub != null) return;
    final active = _startingMic;
    if (active != null) return active;
    final future = _startMicrophone();
    _startingMic = future;
    try {
      await future;
    } finally {
      _startingMic = null;
    }
  }

  Future<void> _startMicrophone() async {
    late final Stream<Uint8List> stream;
    try {
      stream = await _recorder.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
          echoCancel: true,
          noiseSuppress: true,
          autoGain: true,
        ),
      );
    } catch (_) {
      throw const _LiveVoiceFault(
        LiveVoiceFailureStage.capture,
        'Microphone recording could not start. Check the microphone and retry.',
      );
    }
    if (_closed || _muted) {
      try {
        await _recorder.stop();
      } catch (_) {}
      return;
    }
    _micSub = stream.listen(
      (chunk) {
        if (_closed ||
            _muted ||
            chunk.isEmpty ||
            _socket?.readyState != WebSocket.open) {
          return;
        }
        _socket!.add(
          jsonEncode({
            'realtimeInput': {
              'audio': {
                'data': base64Encode(chunk),
                'mimeType': 'audio/pcm;rate=16000',
              },
            },
          }),
        );
      },
      onError: (_) {
        _fail(
          'Microphone streaming stopped. Check the microphone and retry.',
          stage: LiveVoiceFailureStage.capture,
        );
        unawaited(close());
      },
    );
    _state.add(LiveVoiceState.listening);
  }

  Future<void> _handleServerMessage(dynamic raw) async {
    if (_closed) return;
    try {
      String text;
      if (raw is String) {
        text = raw;
      } else if (raw is List<int>) {
        text = utf8.decode(raw);
      } else {
        return;
      }
      final decoded = jsonDecode(text);
      if (decoded is! Map) return;
      final message = decoded.cast<String, dynamic>();
      if (message.containsKey('setupComplete')) {
        _setupTimer?.cancel();
        _setupComplete = true;
        if (!await LivePcmAudio.setSpeaker(_speaker)) {
          throw const _LiveVoiceFault(
            LiveVoiceFailureStage.playback,
            'Audio routing is unavailable. Check your speaker or headset.',
          );
        }
        if (_closed) return;
        // Only model output transcription is enabled. User microphone audio is
        // intentionally never requested or rendered as text.
        final pendingSocket = _socket;
        if (pendingSocket == null || _closed) return;
        pendingSocket.add(
          jsonEncode({
            'clientContent': {
              'turns': [
                {
                  'role': 'user',
                  'parts': [
                    {
                      'text': captureInputTranscription
                          ? 'Start the Twin interview now with one brief welcoming question. '
                                'Do not ask about language.'
                          : 'Start this live conversation now with a brief natural greeting, '
                                'then ask how you can help. Speak in the language most appropriate '
                                'for the user and keep the opening short.',
                    },
                  ],
                },
              ],
              'turnComplete': true,
            },
          }),
        );
        await _beginMicrophone();
        if (!_ready.isCompleted && !_closed) {
          _ready.complete();
        }
        return;
      }
      if (message.containsKey('error') || message.containsKey('goAway')) {
        _fail(
          'Live voice connection ended. Start a new call to reconnect.',
          stage: LiveVoiceFailureStage.transport,
        );
        unawaited(close());
        return;
      }

      final server = message['serverContent'];
      if (server is! Map) return;
      if (server['interrupted'] == true) {
        await LivePcmAudio.stop();
        if (_closed) return;
        _state.add(LiveVoiceState.interrupted);
        return;
      }

      if (captureInputTranscription) {
        final inputTranscription = server['inputTranscription'];
        if (inputTranscription is Map) {
          final transcript = inputTranscription['text'];
          if (transcript is String && transcript.trim().isNotEmpty) {
            _inputTranscripts.add(transcript);
          }
        }
      }

      final outputTranscription = server['outputTranscription'];
      if (outputTranscription is Map) {
        final transcript = outputTranscription['text'];
        if (transcript is String && transcript.isNotEmpty) {
          _transcripts.add(transcript);
        }
      }

      final modelTurn = server['modelTurn'];
      if (modelTurn is Map) {
        final parts = modelTurn['parts'];
        if (parts is List) {
          for (final part in parts) {
            if (_closed) return;
            if (part is! Map) continue;
            final inline = part['inlineData'];
            if (inline is! Map) continue;
            final mime = inline['mimeType'];
            final data = inline['data'];
            if (mime is String &&
                mime.startsWith('audio/pcm') &&
                data is String &&
                data.isNotEmpty) {
              _state.add(LiveVoiceState.speaking);
              if (!await LivePcmAudio.start(sampleRate: 24000)) {
                throw const _LiveVoiceFault(
                  LiveVoiceFailureStage.playback,
                  'Live voice playback is unavailable on this device.',
                );
              }
              if (_closed) return;
              if (!await LivePcmAudio.write(base64Decode(data))) {
                throw const _LiveVoiceFault(
                  LiveVoiceFailureStage.playback,
                  'Live voice playback stopped. Check your audio output.',
                );
              }
            }
          }
        }
      }
      if (!_closed && server['turnComplete'] == true) {
        _turnCompletions.add(null);
        _state.add(LiveVoiceState.listening);
      }
    } on _LiveVoiceFault catch (fault) {
      _fail(fault.message, stage: fault.stage);
      unawaited(close());
    } catch (_) {
      _fail(
        'Live voice received an invalid audio event.',
        stage: LiveVoiceFailureStage.signaling,
      );
      unawaited(close());
    }
  }

  Future<void> setSpeaker(bool enabled) async {
    if (_closed) return;
    _speaker = enabled;
    if (!await LivePcmAudio.setSpeaker(enabled)) {
      _fail(
        'Could not change the audio output. Check your speaker or headset.',
        stage: LiveVoiceFailureStage.playback,
      );
      unawaited(close());
    }
  }

  Future<void> mute(bool muted) async {
    if (_closed) return;
    _muted = muted;
    if (muted) {
      await _startingMic;
      if (_closed) return;
      await _micSub?.cancel();
      _micSub = null;
      try {
        await _recorder.stop();
      } catch (_) {}
    } else {
      await _beginMicrophone();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      unawaited(close());
    }
  }

  void _fail(
    String message, {
    LiveVoiceFailureStage stage = LiveVoiceFailureStage.signaling,
  }) {
    if (_closed) return;
    if (!_ready.isCompleted) {
      _ready.completeError(StateError(message));
    }
    _failures.add(LiveVoiceFailure(stage, message));
    _errors.add(message);
    _state.add(LiveVoiceState.failed);
  }

  Future<void> close() async {
    final active = _closing;
    if (active != null) return active;
    final future = _close();
    _closing = future;
    return future;
  }

  Future<void> _close() async {
    if (_closed) return;
    _closed = true;
    if (!_ready.isCompleted) {
      _ready.completeError(
        StateError('Live voice ended before media setup completed.'),
      );
    }
    _setupTimer?.cancel();
    if (_observing) {
      WidgetsBinding.instance.removeObserver(this);
      _observing = false;
    }
    await _interruptions?.cancel();
    await _noisy?.cancel();
    await _socketSub?.cancel();
    try {
      await _startingMic;
    } catch (_) {}
    await _micSub?.cancel();
    _micSub = null;
    try {
      await _recorder.stop();
    } catch (_) {}
    try {
      await _recorder.dispose();
    } catch (_) {}
    await LivePcmAudio.release();
    try {
      await _socket?.close(WebSocketStatus.normalClosure, 'ended');
    } catch (_) {}
    _socket = null;
    try {
      final audioSession = await AudioSession.instance;
      await audioSession.setActive(false);
    } catch (_) {}
    _state.add(LiveVoiceState.ended);
    await _state.close();
    await _errors.close();
    await _failures.close();
    await _transcripts.close();
    await _inputTranscripts.close();
    await _turnCompletions.close();
  }
}
