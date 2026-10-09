import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_mobile/src/talk_post_session/talk_post_session.dart';

class FakeTransport implements TalkInsightTransport {
  final delayed = Completer<TalkInsightDraft?>();
  int writes = 0;
  @override
  Future<TalkInsightDraft?> read(String talkId) => delayed.future;
  @override
  Future<TalkInsightDraft> generate(String talkId) async {
    writes++;
    return TalkInsightDraft(
      talkId: talkId,recordingId: 'recording_1',
      status: TalkInsightStatus.ready,summary: 'Private host draft',
      updatedAt: DateTime.utc(2026,10,9),
    );
  }
}
void main() {
  test('private insight DTO rejects forged status or overlong content', () {
    expect(() => TalkInsightDraft.fromJson({
      'talkId':'t','recordingId':'r','status':'published',
      'updatedAt':'2026-10-09T00:00:00.000Z','highlights':[],
    }), throwsFormatException);
    expect(() => TalkInsightDraft.fromJson({
      'talkId':'t','recordingId':'r','status':'ready',
      'updatedAt':'2026-10-09T00:00:00.000Z','highlights':['x'*301],
    }), throwsFormatException);
  });
  test('wrong owner cannot send generation, even with consent', () async {
    final fake = FakeTransport();
    var active = 'other';
    final controller = TalkInsightController(
      talkId:'talk_1',ownerId:'host',activeOwnerId:()=>active,transport:fake,
    );
    await controller.generate(explicitConsent:true);
    expect(fake.writes,0);
    active = 'host';
    await controller.generate(explicitConsent:false);
    expect(fake.writes,0);
    controller.dispose();
  });
  test('logout or account switch discards late private read', () async {
    final fake = FakeTransport();
    var active = 'host';
    final controller = TalkInsightController(
      talkId:'talk_1',ownerId:'host',activeOwnerId:()=>active,transport:fake,
    );
    final read = controller.refresh();
    active = 'second-user';
    controller.resetOwner('second-user');
    fake.delayed.complete(TalkInsightDraft(
      talkId:'talk_1',recordingId:'recording_1',
      updatedAt:DateTime.utc(2026,10,9),status:TalkInsightStatus.ready,
      summary:'Old private data',
    ));
    await read;
    expect(controller.draft,isNull);
    expect(controller.state,TalkInsightUiState.idle);
    controller.dispose();
  });
}
