/// The accepted quote and reservation expiry both bound native paid audio.
Duration paidNativeCallMaxDuration({
  required int estimatedSeconds,
  required DateTime admissionExpiresAt,
  required DateTime now,
}) {
  final quoted = Duration(seconds: estimatedSeconds);
  final remaining = admissionExpiresAt.difference(now);
  if (remaining <= Duration.zero || quoted <= Duration.zero) {
    return Duration.zero;
  }
  return remaining < quoted ? remaining : quoted;
}
