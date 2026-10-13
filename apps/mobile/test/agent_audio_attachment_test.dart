import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/agent_audio_attachment.dart';

void main() {
  test('Gemini PCM16 24 kHz is wrapped in a valid little-endian mono WAV', () {
    final pcm = Uint8List.fromList([0, 0, 255, 127, 0, 128, 13, 0]);
    final playable = prepareAgentAudioAttachment(
      pcm,
      mimeType: 'audio/L16;rate=24000',
    );
    expect(playable.extension, 'wav');
    expect(playable.isWav, isTrue);
    expect(playable.bytes.length, 52);
    expect(String.fromCharCodes(playable.bytes.sublist(0, 4)), 'RIFF');
    expect(String.fromCharCodes(playable.bytes.sublist(8, 12)), 'WAVE');
    expect(String.fromCharCodes(playable.bytes.sublist(12, 16)), 'fmt ');
    expect(String.fromCharCodes(playable.bytes.sublist(36, 40)), 'data');
    final header = ByteData.sublistView(playable.bytes);
    expect(header.getUint32(4, Endian.little), 44);
    expect(header.getUint16(20, Endian.little), 1);
    expect(header.getUint16(22, Endian.little), 1);
    expect(header.getUint32(24, Endian.little), 24000);
    expect(header.getUint32(28, Endian.little), 48000);
    expect(header.getUint16(34, Endian.little), 16);
    expect(header.getUint32(40, Endian.little), pcm.length);
    expect(playable.bytes.sublist(44), orderedEquals(pcm));
  });

  test('sample rate in provider MIME controls WAV audio playback speed', () {
    final playable = prepareAgentAudioAttachment(
      Uint8List(1600),
      mimeType: 'audio/pcm;rate=16000',
    );
    final header = ByteData.sublistView(playable.bytes);
    expect(header.getUint32(24, Endian.little), 16000);
    expect(header.getUint32(28, Endian.little), 32000);
  });

  test('already-encoded audio keeps its true file extension', () {
    final mp3 = Uint8List.fromList([73, 68, 51, 0]);
    final result = prepareAgentAudioAttachment(
      mp3,
      mimeType: 'audio/mpeg',
    );
    expect(result.extension, 'mp3');
    expect(result.isWav, false);
    expect(identical(result.bytes, mp3), true);
    expect(prepareAgentAudioAttachment(
      Uint8List.fromList([1, 2, 3]),
      mimeType: 'audio/mp4',
    ).extension, 'm4a');
  });

  test('rejects incomplete PCM samples and falsely labelled WAV files', () {
    expect(
      () => prepareAgentAudioAttachment(
        Uint8List.fromList([0, 1, 2]),
        mimeType: 'audio/pcm;rate=24000',
      ),
      throwsFormatException,
    );
    expect(
      () => prepareAgentAudioAttachment(
        Uint8List(48),
        mimeType: 'audio/wav',
      ),
      throwsFormatException,
    );
    expect(
      () => prepareAgentAudioAttachment(
        Uint8List.fromList([1]),
        mimeType: null,
      ),
      throwsFormatException,
    );
  });
}
