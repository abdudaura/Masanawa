import 'network/api_client.dart';

/// Safe, stage-specific audio failures. Never expose provider URLs/tokens.
class AudioFailure implements Exception {
  const AudioFailure(this.code, this.message);
  final String code;
  final String message;
}

String audioFailureMessage(Object error, {String fallback = 'The call could not connect. Please try again.'}) {
  if (error is AudioFailure) return error.message;
  if (error is ApiException) return error.message;
  return fallback;
}
