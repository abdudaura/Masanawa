import 'dart:typed_data';

import 'package:flutter/services.dart';

/// Thin native bridge for low-latency Gemini Live PCM playback.
///
/// Android receives mono PCM16 at 24 kHz and feeds it to AudioTrack in stream
/// mode. Unsupported platforms fail closed to buffered WAV playback.
class LivePcmAudio {
  LivePcmAudio._();

  static const MethodChannel _channel = MethodChannel('masanawa/live_pcm');

  // PCM16 mono frames: bound untrusted provider output before a platform call.
  // The native AudioTrack bridge accepts standard speech output rates.
  static const int _minSampleRate = 8000;
  static const int _maxSampleRate = 48000;
  static const int _maxFrameBytes = 256 * 1024;

  static Future<bool> start({int sampleRate = 24000}) async {
    if (sampleRate < _minSampleRate || sampleRate > _maxSampleRate) {
      return false;
    }
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

  static Future<bool> write(Uint8List bytes) async {
    if (bytes.isEmpty) return true;
    // Misaligned PCM16 or a huge chunk must never enter the native AudioTrack.
    if (bytes.lengthInBytes.isOdd || bytes.lengthInBytes > _maxFrameBytes) {
      return false;
    }
    try {
      return await _channel.invokeMethod<bool>('write', {'bytes': bytes}) ?? false;
    } on MissingPluginException {
      // Buffered WAV playback remains available.
      return false;
    } on PlatformException {
      // Buffered WAV playback remains available.
      return false;
    }
  }

  static Future<bool> setSpeaker(bool enabled) async {
    try {
      return await _channel.invokeMethod<bool>(
            'speaker',
            {'enabled': enabled},
          ) ??
          false;
    } on MissingPluginException {
      return false;
    } on PlatformException {
      return false;
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

  /// Ending a live call also restores Android's normal communication route.
  static Future<void> release() async {
    try {
      await _channel.invokeMethod<void>('release');
    } on MissingPluginException {
      // Unsupported platform.
    } on PlatformException {
      // Audio may already have been released by Android.
    }
  }
}
