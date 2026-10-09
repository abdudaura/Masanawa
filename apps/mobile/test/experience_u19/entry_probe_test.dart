import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/experience_quality/entry_probe.dart';
import 'package:masanawa/src/experience_quality/experience_metrics.dart';

void main() {
  test('stale ready after newer entry cannot produce false success', () {
    final metrics = ExperienceMetrics();
    final probe = ExperienceEntryProbe(metrics);
    final old = probe.start(ExperienceJourney.cachedChatsEntry);
    final current = probe.start(ExperienceJourney.assistantEntry);
    expect(probe.completeUsable(old), isFalse);
    expect(probe.completeUsable(current), isTrue);
    expect(probe.completeUsable(current), isFalse);
    expect(metrics.summarize(ExperienceJourney.cachedChatsEntry).count, 0);
    expect(metrics.summarize(ExperienceJourney.assistantEntry).count, 1);
    expect(metrics.summarize(ExperienceJourney.assistantEntry)
        .hasNetworkEvidence, isFalse);
  });

  test('failed entry and account change revoke pending timing', () {
    final metrics = ExperienceMetrics();
    final probe = ExperienceEntryProbe(metrics);
    final one = probe.start(ExperienceJourney.talksEntry);
    probe.fail(one);
    expect(probe.completeUsable(one), isFalse);
    expect(metrics.summarize(ExperienceJourney.talksEntry).count, 0);
    final two = probe.start(ExperienceJourney.talksEntry);
    expect(probe.completeUsable(two, responseBytes: 12), isTrue);
    expect(metrics.summarize(ExperienceJourney.talksEntry)
        .totalResponseBytes, 12);
    final three = probe.start(ExperienceJourney.talksEntry);
    probe.resetForAccountChange();
    expect(probe.completeUsable(three), isFalse);
    expect(metrics.summarize(ExperienceJourney.talksEntry).count, 0);
  });
}
