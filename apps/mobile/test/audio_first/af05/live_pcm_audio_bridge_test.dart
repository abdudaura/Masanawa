import 'dart:typed_data';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/live_pcm_audio.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('masanawa/live_pcm');
  final calls = <MethodCall>[];

  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      return true;
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('rejects unsupported rates before native allocation', () async {
    expect(await LivePcmAudio.start(sampleRate: 0), isFalse);
    expect(await LivePcmAudio.start(sampleRate: 7999), isFalse);
    expect(await LivePcmAudio.start(sampleRate: 48001), isFalse);
    expect(calls, isEmpty);
  });

  test('accepts bounded speech sample rates', () async {
    expect(await LivePcmAudio.start(sampleRate: 16000), isTrue);
    expect(await LivePcmAudio.start(sampleRate: 24000), isTrue);
    expect(calls.map((call) => call.method), ['start', 'start']);
    expect((calls.last.arguments as Map)['sampleRate'], 24000);
  });

  test('rejects odd PCM16 and excessive frames without native calls', () async {
    expect(await LivePcmAudio.write(Uint8List.fromList([1])), isFalse);
    expect(await LivePcmAudio.write(Uint8List(256 * 1024 + 2)), isFalse);
    expect(calls, isEmpty);
  });

  test('empty frame is a no-op; valid aligned frame reaches native', () async {
    expect(await LivePcmAudio.write(Uint8List(0)), isTrue);
    expect(calls, isEmpty);
    expect(await LivePcmAudio.write(Uint8List.fromList([1, 0, 2, 0])),
        isTrue);
    expect(calls.single.method, 'write');
    expect((calls.single.arguments as Map)['bytes'], isA<Uint8List>());
  });

  test('missing plugin falls back without throwing', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
    expect(await LivePcmAudio.start(), isFalse);
    expect(await LivePcmAudio.write(Uint8List.fromList([1, 0])), isFalse);
  });
}
