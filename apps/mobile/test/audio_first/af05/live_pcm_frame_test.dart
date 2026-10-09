import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_focus/live_pcm_frame.dart';

void main() {
  final pcm = Uint8List.fromList([0, 0, 1, 0, 255, 127]);
  final encoded = base64Encode(pcm);

  test('accepts a valid Gemini 24 kHz mono PCM16 event', () {
    final frame = LivePcmFrame.decode(
      mimeType: 'audio/pcm;rate=24000',
      encodedData: encoded,
    );
    expect(frame.sampleRate, 24000);
    expect(frame.bytes, orderedEquals(pcm));
  });

  test('respects the advertised rate rather than pitch-shifting to 24 kHz', () {
    for (final rate in [8000, 16000, 24000, 48000]) {
      final frame = LivePcmFrame.decode(
        mimeType: 'audio/pcm;rate=$rate',
        encodedData: encoded,
      );
      expect(frame.sampleRate, rate);
    }
    // Backward compatibility for early Gemini responses without metadata.
    expect(
      LivePcmFrame.decode(mimeType: 'audio/pcm', encodedData: encoded).sampleRate,
      24000,
    );
  });

  test('refuses unqualified MIME, frequency and channel descriptions', () {
    for (final mime in [
      'audio/mpeg',
      'video/pcm;rate=24000',
      'audio/pcm;rate=0',
      'audio/pcm;rate=48001',
      'audio/pcm;rate=abcd',
      'audio/pcm;rate=24000;channels=2',
      'audio/pcm;rate=-16000',
      'audio/pcm;rate=24000junk',
    ]) {
      expect(
        () => LivePcmFrame.decode(mimeType: mime, encodedData: encoded),
        throwsA(isA<LivePcmFrameException>()),
        reason: mime,
      );
    }
  });

  test('rejects missing, malformed or unaligned PCM16 audio', () {
    for (final data in [
      '',
      'not base64%!',
      base64Encode([0]),
      base64Encode([1, 2, 3]),
    ]) {
      expect(
        () => LivePcmFrame.decode(
          mimeType: 'audio/pcm;rate=24000',
          encodedData: data,
        ),
        throwsA(isA<LivePcmFrameException>()),
        reason: data,
      );
    }
  });

  test('caps provider allocations; exact 256 KiB aligned frame is accepted', () {
    final bound = Uint8List(LivePcmFrame.maxBytes);
    final frame = LivePcmFrame.decode(
      mimeType: 'audio/pcm;rate=24000',
      encodedData: base64Encode(bound),
    );
    expect(frame.bytes.length, LivePcmFrame.maxBytes);

    final oversized = base64Encode(
      Uint8List(LivePcmFrame.maxBytes + 2),
    );
    expect(
      () => LivePcmFrame.decode(
        mimeType: 'audio/pcm;rate=24000',
        encodedData: oversized,
      ),
      throwsA(isA<LivePcmFrameException>()),
    );
  });

  test('provider input never appears inside an output-stage exception', () {
    const secretPayload = 'private-untrusted-audio-payload';
    try {
      LivePcmFrame.decode(
        mimeType: 'audio/pcm;rate=24000',
        encodedData: secretPayload,
      );
      fail('Malformed audio should have been rejected');
    } on LivePcmFrameException catch (error) {
      expect(error.message, isNot(contains(secretPayload)));
      expect(error.toString(), isNot(contains(secretPayload)));
    }
  });
}
