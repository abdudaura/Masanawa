import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/audio_failure.dart';
import 'package:masanawa/src/core/network/api_client.dart';
void main() {
 test('gateway failure retains its safe cause rather than blaming microphone', () {
  expect(audioFailureMessage(const ApiException('Voice service is temporarily unavailable')), 'Voice service is temporarily unavailable');
 });
 test('unknown native errors use the supplied recording cause', () {
  expect(audioFailureMessage(StateError('native failure'), fallback:'Recording could not start.'), 'Recording could not start.');
 });
 test('only explicit permission denial names permission', () {
  expect(audioFailureMessage(const AudioFailure('permission','Microphone permission was denied.')), 'Microphone permission was denied.');
 });
}
