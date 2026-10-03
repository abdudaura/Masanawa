import 'dart:io';

import 'package:flutter/services.dart';

const bool kAlphaTtsEnabled = bool.fromEnvironment(
  'ALPHA_TTS_ENABLED',
  defaultValue: false,
);

const String kAlphaTtsLanguage = String.fromEnvironment(
  'ALPHA_TTS_LANGUAGE',
  defaultValue: 'en-US',
);

class AlphaSpeech {
  AlphaSpeech._();

  static const MethodChannel _channel =
      MethodChannel('masanawa/alpha_tts');

  static Future<void> speak(String text) async {
    if (!kAlphaTtsEnabled || !Platform.isAndroid) return;
    final value = text.trim();
    if (value.isEmpty) return;
    try {
      await _channel.invokeMethod<bool>('speak', {
        'text': value,
        'language': kAlphaTtsLanguage,
      });
    } on PlatformException {
      // Alpha speech is best effort. Text remains the canonical result.
    } on MissingPluginException {
      // Non-Android/test environments have no native bridge.
    }
  }

  static Future<void> stop() async {
    if (!kAlphaTtsEnabled || !Platform.isAndroid) return;
    try {
      await _channel.invokeMethod<bool>('stop');
    } catch (_) {}
  }
}
