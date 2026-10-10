import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talk_host_copilot/host_preparation.dart';
import 'package:masanawa/src/talk_host_copilot/host_preparation_controller.dart';

const sample = HostPreparation(
  prepId: 'bb2b9d81-6c10-40c3-87a1-bf5b3f7eed10',
  title: 'Topic', topic: 'A Talk', questions: ['Why?'],
  revision: 1, phase: HostPreparationPhase.draft,
);

class FakePrepTransport implements HostPreparationTransport {
  final Completer<HostPreparation> pending = Completer<HostPreparation>();
  int creates = 0;
  int publishes = 0;
  bool failPublish = false;
  @override
  Future<List<HostPreparation>> list() async => [sample];
  @override
  Future<HostPreparation> create({required String title,
      required String topic, required List<String> questions}) {
    creates++;
    return pending.future;
  }
  @override
  Future<HostPreparation> read(String id) async => sample;
  @override
  Future<HostPreparation> edit({required String prepId, required int revision,
      required String title, required String topic,
      required List<String> questions}) async => HostPreparation(
        prepId: prepId, title: title, topic: topic, questions: questions,
        revision: revision + 1, phase: HostPreparationPhase.draft);
  @override
  Future<HostPreparation> goLive(String prepId, int revision) async {
    publishes++;
    if (failPublish) throw StateError('unknown result');
    return const HostPreparation(
      prepId: sample.prepId, title: sample.title, topic: sample.topic,
      questions: sample.questions, revision: 3,
      phase: HostPreparationPhase.published,
      talkId: 'talk_uuid');
  }
  @override
  Future<HostPreparation> verify(String id) async => const HostPreparation(
    prepId: sample.prepId, title: sample.title, topic: sample.topic,
    questions: sample.questions, revision: 3,
    phase: HostPreparationPhase.published,
    talkId: 'talk_uuid');
  @override
  Future<List<Map<String, dynamic>>> experts(String prepId) async => [];
  @override
  Future<Map<String, dynamic>> quoteExpert(String prepId, String personaId) async => {};
}

void main() {
  test('creation does not auto Go Live and account switch drops stale response', () async {
    final t = FakePrepTransport();
    final c = HostPreparationController(transport: t, accountKey: 'a');
    final pending = c.create(title: 'Topic', topic: 'A Talk', questions: []);
    expect(t.creates, 1);
    expect(t.publishes, 0);
    c.switchAccount('b');
    t.pending.complete(sample);
    await pending;
    expect(c.draft, isNull);
    expect(c.error, isNull);
    c.dispose();
  });

  test('an uncertain Go Live is never retried without verified readback', () async {
    final t = FakePrepTransport()..failPublish = true;
    final c = HostPreparationController(transport: t, accountKey: 'a');
    await c.load(sample.prepId);
    expect(c.mayGoLive, true);
    await c.goLiveAfterReview();
    expect(t.publishes, 1);
    expect(c.publicationNeedsReadback, true);
    expect(c.mayGoLive, false);
    await c.goLiveAfterReview();
    expect(t.publishes, 1);
    await c.verifyPublication();
    expect(c.draft?.phase, HostPreparationPhase.published);
    expect(c.publicationNeedsReadback, false);
    c.dispose();
  });

  test('save binds exact last revision', () async {
    final t = FakePrepTransport();
    final c = HostPreparationController(transport: t, accountKey: 'a');
    await c.load(sample.prepId);
    await c.save(title: 'Changed', topic: 'New', questions: const []);
    expect(c.draft?.revision, 2);
    expect(c.draft?.title, 'Changed');
    c.dispose();
  });
}
