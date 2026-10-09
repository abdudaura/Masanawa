import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/experience_quality/experience_metrics.dart';

void main() {
  test('unknown journey is genuinely unmeasured, never a 0 ms pass', () {
    final m = ExperienceMetrics();
    final s = m.summarize(ExperienceJourney.assistantEntry);
    expect(s.count, 0);
    expect(s.p50Micros, isNull);
    expect(s.p95Micros, isNull);
    expect(s.hasNetworkEvidence, isFalse);
  });

  test('bounded nearest-rank distributions and measured bytes only', () {
    final m = ExperienceMetrics(maxSamplesPerJourney: 4);
    for (final d in [10, 20, 50, 90]) {
      m.record(ExperienceJourney.cachedChatsEntry, elapsedMicros: d,
          responseBytes: d == 10 ? 0 : null);
    }
    var s = m.summarize(ExperienceJourney.cachedChatsEntry);
    expect(s.count, 4);
    expect(s.p50Micros, 20);
    expect(s.p95Micros, 90);
    expect(s.totalResponseBytes, 0);
    expect(s.measuredResponseCount, 1);
    m.record(ExperienceJourney.cachedChatsEntry,
        elapsedMicros: 100, responseBytes: 500);
    s = m.summarize(ExperienceJourney.cachedChatsEntry);
    expect(s.count, 4);
    expect(s.p50Micros, 50);
    expect(s.p95Micros, 100);
    expect(s.totalResponseBytes, 500);
    expect(s.measuredResponseCount, 1);
  });

  test('failed network operations are never counted as usable', () async {
    final m = ExperienceMetrics();
    await expectLater(
      m.measure<int>(ExperienceJourney.talksEntry,
          () async => throw StateError('offline')),
      throwsStateError,
    );
    expect(m.summarize(ExperienceJourney.talksEntry).count, 0);
    expect(await m.measure<String>(
        ExperienceJourney.talksEntry, () async => 'ok',
        responseSize: (value) => value.length), 'ok');
    expect(m.summarize(ExperienceJourney.talksEntry).count, 1);
    expect(m.summarize(ExperienceJourney.talksEntry).totalResponseBytes, 2);
    m.clear(); // On logout/account switch: all measurements vanish.
    expect(m.summarize(ExperienceJourney.talksEntry).count, 0);
  });

  test('malformed timings/bytes and dangerous sample capacities fail closed', () {
    expect(() => ExperienceMetrics(maxSamplesPerJourney: 0), throwsRangeError);
    final m = ExperienceMetrics();
    expect(() => m.record(ExperienceJourney.talksEntry,
        elapsedMicros: -1), throwsArgumentError);
    expect(() => m.record(ExperienceJourney.talksEntry,
        elapsedMicros: 1, responseBytes: -1), throwsArgumentError);
  });
}
