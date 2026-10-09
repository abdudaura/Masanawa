import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_chat_search/human_message_search_controller.dart';
import 'package:masanawa/src/human_chat_search/human_message_search_models.dart';
import 'package:masanawa/src/human_chat_search/human_message_search_screen.dart';
import 'package:masanawa/src/human_chat_search/human_message_search_transport.dart';

class _Transport implements HumanMessageSearchTransport {
  final pending = <Completer<HumanMessageSearchPage>>[];
  @override
  Future<HumanMessageSearchPage> search({
    required String text, String? conversationId, String? after,
  }) {
    final p = Completer<HumanMessageSearchPage>();
    pending.add(p);
    return p.future;
  }
}
void main() {
  testWidgets('shows genuine human hit only and delegates reauthorized jump', (tester) async {
    final transport = _Transport();
    final controller = HumanMessageSearchController(transport)..switchAccount('account:a:session:1');
    String? selected;
    await tester.pumpWidget(MaterialApp(home: HumanMessageSearchScreen(
      controller: controller, openAuthorizedMessage: (hit) async { selected = hit.messageId; },
    )));
    await tester.enterText(find.byType(TextField),'Sannu');
    await tester.tap(find.byTooltip('Search'));
    await tester.pump();
    expect(transport.pending.length,1);
    transport.pending[0].complete(const HumanMessageSearchPage(hits:[
      HumanMessageSearchHit(messageId:'m1',conversationId:'human-c1',senderUserId:'person-b',
        sequence:'1',body:'Sannu',createdAtUs:'2026-10-08T00:00:00.000001Z',editedAt:null),
    ]));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('m1')),findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('m1')));
    expect(selected,'m1');

    controller.switchAccount('account:b:session:2');
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('m1')),findsNothing);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,isEmpty);
    expect(find.text('Search your private human conversations.'),findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });
  testWidgets('without an active session never sends a request', (tester) async {
    final transport = _Transport();
    final controller = HumanMessageSearchController(transport);
    await tester.pumpWidget(MaterialApp(home: HumanMessageSearchScreen(
      controller:controller,openAuthorizedMessage:(_) async {},
    )));
    await tester.enterText(find.byType(TextField),'private words');
    await tester.tap(find.byTooltip('Search'));
    await tester.pump();
    expect(transport.pending,isEmpty);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });
}
