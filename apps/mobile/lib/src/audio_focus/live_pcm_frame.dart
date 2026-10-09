import 'dart:convert';
import 'dart:typed_data';

/// A validated, bounded mono PCM16 frame received from the live speech model.
///
/// This is a transport/output boundary, not a microphone capture or media
/// storage format. Do not log the incoming Base64 or audio bytes on failure.
final class LivePcmFrame {
  const LivePcmFrame._(this.bytes, this.sampleRate);

  /// Allows up to ~5.5 seconds at 24 kHz. Reject an oversized frame before
  /// Base64 decoding so a malformed/untrusted provider response cannot cause
  /// an unbounded playback allocation.
  static const int maxBytes = 256 * 1024;
  static const int _maxBase64Length = ((maxBytes + 2) ~/ 3) * 4;

  final Uint8List bytes;
  final int sampleRate;

  /// Gemini Live emits audio/pcm;rate=24000; bare audio/pcm is the legacy
  /// 24-kHz response. Never play a different advertised rate at 24 kHz.
  factory LivePcmFrame.decode({
    required String mimeType,
    required String encodedData,
  }) {
    final match = RegExp(r'^audio/pcm(?:;rate=([0-9]+))?$')
        .firstMatch(mimeType.trim().toLowerCase());
    if (match == null) {
      throw const LivePcmFrameException('Unsupported live audio encoding.');
    }
    final rateString = match.group(1);
    final sampleRate = rateString == null ? 24000 : int.tryParse(rateString);
    // Match Android AudioTrack's supported range, without allowing an
    // arbitrarily large or zero rate to reach the native method channel.
    if (sampleRate == null || sampleRate < 8000 || sampleRate > 48000) {
      throw const LivePcmFrameException('Unsupported live audio sample rate.');
    }
    if (encodedData.isEmpty || encodedData.length > _maxBase64Length) {
      throw const LivePcmFrameException('Live audio frame size is invalid.');
    }
    late final Uint8List bytes;
    try {
      bytes = base64Decode(encodedData);
    } on FormatException {
      throw const LivePcmFrameException('Live audio frame is not Base64.');
    }
    // PCM16 samples are two bytes. Silently accepting odd lengths produces
    // clipped/static playback and makes the next chunk sound corrupted.
    if (bytes.isEmpty || bytes.length.isOdd || bytes.length > maxBytes) {
      throw const LivePcmFrameException('Live audio PCM16 frame is invalid.');
    }
    return LivePcmFrame._(bytes, sampleRate);
  }
}

/// A safe, printable output-stage error; never includes model-supplied data.
final class LivePcmFrameException implements Exception {
  const LivePcmFrameException(this.message);

  final String message;

  @override
  String toString() => message;
}
