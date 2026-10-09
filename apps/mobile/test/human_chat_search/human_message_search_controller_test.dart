import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_mobile/src/human_chat_search/human_message_search_controller.dart';
import 'package:masanawa_mobile/src/human_chat_search/human_message_search_models.dart';
import 'package:masanawa_mobile/src/human_chat_search/human_message_search_transport.dart';

const record = HumanMessageSearchHit(
  messageId:'m1', conversationId:'c1', senderUserId:'u2',
  sequence:'1', body:'Sannu', createdAtUs:'2026-10-08T10:10:10.123456Z',
  editedAt:null,
);
class FakeTransport implements HumanMessageSearchTransport {
  final requests = <String>[];
  final pending = <Completer<HumanMessageSearchPage>>[];
  @override
  Future<HumanMessageSearchPage> search({
    required String text, String? conversationId, String? after,
  }) {
    requests.add('$text|$conversationId|$after');
    final completer = Completer<HumanMessageSearchPage>();
    pending.add(completer);
    return completer.future;
  }
}
void main() {
  test('no session never starts network or retains a previous search', () async {
    final fake = FakeTransport();
    final controller = HumanMessageSearchController(fake);
    await controller.find('Sannu');
    expect(fake.requests, isEmpty);
    controller.switchAccount('a:session-1');
    final pending = controller.find('Sannu');
    controller.switchAccount(null);
    fake.pending.first.complete(const HumanMessageSearchPage(hits:[record]));
    await pending;
    expect(controller.hits, isEmpty);
    expect(controller.activeQuery, isNull);
    controller.dispose();
  });
  test('out-of-order response cannot overwrite a newer private query', () async {
    final fake = FakeTransport();
    final controller = HumanMessageSearchController(fake)..switchAccount('a:session-1');
    final first = controller.find('older');
    final second = controller.find('newer');
    fake.pending[1].complete(const HumanMessageSearchPage(hits:[record]));
    await second;
    fake.pending[0].complete(const HumanMessageSearchPage(hits:[]));
    await first;
    expect(controller.hits.map((h)=>h.messageId),['m1']);
    expect(controller.activeQuery,'newer');
    controller.dispose();
  });
  test('pagination deduplicates and discarded logout response never leaks', () async {
    final fake = FakeTransport();
    final controller = HumanMessageSearchController(fake)..switchAccount('user:a:device:1');
    final first = controller.find('Sannu');
    fake.pending[0].complete(const HumanMessageSearchPage(hits:[record],next:'signed1'));
    await first;
    final more = controller.loadMore();
    fake.pending[1].complete(const HumanMessageSearchPage(hits:[record],next:null));
    await more;
    expect(controller.hits.length,1);
    final stale = controller.find('Other');
    controller.switchAccount('user:b:device:2');
    fake.pending[2].complete(const HumanMessageSearchPage(hits:[record]));
    await stale;
    expect(controller.hits,isEmpty);
    expect(controller.activeQuery,isNull);
    controller.dispose();
  });
  test('typed JSON rejects malformed and accepts bounded result contract', () {
    expect(()=>HumanMessageSearchPage.fromJson({'hits':'not-list'}),throwsFormatException);
    expect(()=>HumanMessageSearchPage.fromJson({'hits':[{'messageId':'m1'}]}),throwsFormatException);
    expect(HumanMessageSearchPage.fromJson({'hits':[{
      'messageId':'m1','conversationId':'c1','senderUserId':'u2',
      'sequence':'1','body':'مرحبا','createdAtUs':'2026-10-08T00:00:00.000001Z',
    }]}).hits.first.body,'مرحبا');
  });
}
