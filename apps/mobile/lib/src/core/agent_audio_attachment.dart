import 'dart:typed_data';

/// Audio returned by the agent provider is not necessarily a WAV container.
/// Gemini typically returns headerless 16-bit mono PCM, which must not be
/// written to a .wav file unchanged: Android's file player cannot decode it.
class AgentAudioAttachment {
  const AgentAudioAttachment({
    required this.bytes,
    required this.extension,
    required this.isWav,
  });

  final Uint8List bytes;
  final String extension;
  final bool isWav;
}

AgentAudioAttachment prepareAgentAudioAttachment(
  Uint8List bytes, {
  required String? mimeType,
}) {
  if (bytes.isEmpty) throw const FormatException('Empty agent audio');
  final mime = mimeType?.trim().toLowerCase() ?? '';
  final mediaType = mime.split(';').first.trim();

  if (mediaType == 'audio/pcm' || mediaType == 'audio/l16') {
    if (bytes.length.isOdd || bytes.length > 32 * 1024 * 1024) {
      throw const FormatException('Invalid PCM16 voice response');
    }
    final rate = RegExp(r'(?:^|;)\s*rate=(\d+)', caseSensitive: false)
        .firstMatch(mime);
    final requested = int.tryParse(rate?.group(1) ?? '') ?? 24000;
    final sampleRate =
        requested >= 8000 && requested <= 96000 ? requested : 24000;

    final wav = Uint8List(44 + bytes.length);
    wav.setRange(0, 4, 'RIFF'.codeUnits);
    wav.setRange(8, 12, 'WAVE'.codeUnits);
    wav.setRange(12, 16, 'fmt '.codeUnits);
    wav.setRange(36, 40, 'data'.codeUnits);
    final header = ByteData.sublistView(wav);
    header.setUint32(4, 36 + bytes.length, Endian.little);
    header.setUint32(16, 16, Endian.little);
    header.setUint16(20, 1, Endian.little); // Linear PCM
    header.setUint16(22, 1, Endian.little); // Mono
    header.setUint32(24, sampleRate, Endian.little);
    header.setUint32(28, sampleRate * 2, Endian.little);
    header.setUint16(32, 2, Endian.little);
    header.setUint16(34, 16, Endian.little);
    header.setUint32(40, bytes.length, Endian.little);
    wav.setRange(44, wav.length, bytes);
    return AgentAudioAttachment(bytes: wav, extension: 'wav', isWav: true);
  }

  if (mediaType == 'audio/wav' || mediaType == 'audio/x-wav') {
    if (bytes.length < 44 ||
        String.fromCharCodes(bytes.sublist(0, 4)) != 'RIFF' ||
        String.fromCharCodes(bytes.sublist(8, 12)) != 'WAVE') {
      throw const FormatException('Invalid WAV agent audio');
    }
    return AgentAudioAttachment(bytes: bytes, extension: 'wav', isWav: true);
  }

  final extension = switch (mediaType) {
    'audio/mpeg' || 'audio/mp3' => 'mp3',
    'audio/m4a' || 'audio/mp4' || 'audio/aac' => 'm4a',
    'audio/ogg' => 'ogg',
    'audio/webm' => 'webm',
    _ => null,
  };
  if (extension == null) {
    throw FormatException('Unsupported agent audio format: $mediaType');
  }
  return AgentAudioAttachment(
    bytes: bytes,
    extension: extension,
    isWav: false,
  );
}
