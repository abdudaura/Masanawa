import 'dart:typed_data';

import 'package:flutter/services.dart';

/// Thin native bridge for low-latency Gemini Live PCM playback.
///
/// Android receives mono PCM16 at 24 kHz and feeds it to AudioTrack in stream
/// mode. Unsupported platforms fail closed to buffered WAV playback.
class LivePcmAudio {
  LivePcmAudio._();

  static const MethodChannel _channel = MethodChannel('masanawa/live_pcm');

  static Future<bool> start({int sampleRate = 24000}) async {
    try {
      return await _channel.invokeMethod<bool>(
            'start',
            {'sampleRate': sampleRate},
          ) ??
          false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
    }
  }

  static Future<void> write(Uint8List bytes) async {
    if (bytes.isEmpty) return;
    try {
      await _channel.invokeMethod<void>('write', {'bytes': bytes});
    } on MissingPluginException {
      // Buffered WAV playback remains available.
    } on PlatformException {
      // Buffered WAV playback remains available.
    }
  }

  static Future<void> stop() async {
    try {
      await _channel.invokeMethod<void>('stop');
    } on MissingPluginException {
      // Unsupported platform.
    } on PlatformException {
      // Unsupported platform.
    }
  }
}
