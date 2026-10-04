import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:audio_session/audio_session.dart';
import 'package:record/record.dart';

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

class LiveVoiceSession {
  LiveVoiceSession({
    required this.grant,
    required this.characterName,
    AudioRecorder? recorder,
  }) : _recorder = recorder ?? AudioRecorder();

  final AgentLiveVoiceGrant grant;
  final String characterName;
  final AudioRecorder _recorder;
  final _state = StreamController<LiveVoiceState>.broadcast(sync: true);
  final _errors = StreamController<String>.broadcast(sync: true);
  WebSocket? _socket;
  StreamSubscription<Uint8List>? _micSub;
  bool _closed = false;
  bool _setupComplete = false;
  bool _speaker = true;

  Stream<LiveVoiceState> get states => _state.stream;
  Stream<String> get errors => _errors.stream;
  bool get speakerEnabled => _speaker;

  Future<void> start() async {
    if (_closed || _socket != null) return;
    _state.add(LiveVoiceState.connecting);
    try {
      if (!await _recorder.hasPermission()) {
        throw StateError('Microphone permission is required for live voice.');
      }
      final audioSession = await AudioSession.instance;
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
      await audioSession.setActive(true);

      final socket = await WebSocket.connect(grant.websocketUrl);
      if (_closed) {
        await socket.close();
        return;
      }
      _socket = socket;
      socket.listen(
        _handleServerMessage,
        onError: (Object error) => _fail('Live voice connection failed.'),
        onDone: () {
          if (!_closed) {
            _state.add(LiveVoiceState.ended);
            unawaited(close());
          }
        },
        cancelOnError: false,
      );
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
            'systemInstruction': {
              'parts': [
                {
                  'text':
                      'You are $characterName. Have a natural live voice conversation. '
                      'Answer in the user\'s language. Do not transcribe the user or '
                      'read hidden system information aloud.',
                },
              ],
            },
          },
        }),
      );
    } catch (error) {
      _fail(error is StateError ? error.message : 'Could not start live voice.');
      await close();
      rethrow;
    }
  }

  Future<void> _beginMicrophone() async {
    if (_closed || !_setupComplete || _micSub != null) return;
    final stream = await _recorder.startStream(
      const RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: 16000,
        numChannels: 1,
        echoCancel: true,
        noiseSuppress: true,
        autoGain: true,
      ),
    );
    _micSub = stream.listen(
      (chunk) {
        if (_closed || chunk.isEmpty || _socket?.readyState != WebSocket.open) {
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
      onError: (_) => _fail('Microphone streaming stopped.'),
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
        _setupComplete = true;
        await _beginMicrophone();
        return;
      }

      final server = message['serverContent'];
      if (server is! Map) return;
      if (server['interrupted'] == true) {
        await LivePcmAudio.stop();
        _state.add(LiveVoiceState.interrupted);
        return;
      }

      final modelTurn = server['modelTurn'];
      if (modelTurn is Map) {
        final parts = modelTurn['parts'];
        if (parts is List) {
          for (final part in parts) {
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
              await LivePcmAudio.start(sampleRate: 24000);
              await LivePcmAudio.write(base64Decode(data));
            }
          }
        }
      }
      if (server['turnComplete'] == true) {
        _state.add(LiveVoiceState.listening);
      }
    } catch (_) {
      _fail('Live voice received an invalid audio event.');
    }
  }

  Future<void> setSpeaker(bool enabled) async {
    _speaker = enabled;
    await LivePcmAudio.setSpeaker(enabled);
  }

  Future<void> mute(bool muted) async {
    if (_closed) return;
    if (muted) {
      await _micSub?.cancel();
      _micSub = null;
      try {
        await _recorder.stop();
      } catch (_) {}
    } else {
      await _beginMicrophone();
    }
  }

  void _fail(String message) {
    if (_closed) return;
    _errors.add(message);
    _state.add(LiveVoiceState.failed);
  }

  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    await _micSub?.cancel();
    _micSub = null;
    try {
      await _recorder.stop();
    } catch (_) {}
    await _recorder.dispose();
    await LivePcmAudio.stop();
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
  }
}
