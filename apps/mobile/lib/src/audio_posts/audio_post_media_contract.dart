/// The immutable, server-verified, actor-owned result required before a Talk
/// can enter the durable publish flow. Client plausibility is NOT authority:
/// the Gateway independently re-verifies asset ownership, codec and duration.
class VerifiedPostAudio {
  const VerifiedPostAudio({required this.assetId, required this.durationMs});
  final String assetId;
  final int durationMs;
  bool get isPlausible =>
      RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$').hasMatch(assetId) &&
      durationMs >= 1000 && durationMs <= 180000;
}

typedef AcquireVerifiedPostAudio = Future<VerifiedPostAudio?> Function();
enum AudioCaptureFailure { permission, offline, tooLong, unavailable, other }
class AudioCaptureException implements Exception {
  const AudioCaptureException(this.reason);
  final AudioCaptureFailure reason;
}
