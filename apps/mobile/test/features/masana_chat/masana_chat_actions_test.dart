import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:masanawa/src/features/masana_chat/masana_chat_api.dart';
import 'package:masanawa/src/features/masana_chat/masana_chat_controller.dart';
import 'package:masanawa/src/features/masana_chat/masana_chat_screen.dart';

class ActionApi extends MasanaChatApi {
  ActionApi():super(Dio());
  bool failHide=false;
  final hidden=<String>[];
  @override Future<String> open(String _) async =>
    'character-session_0199f0d0-0000-7000-8000-000000000001';
  @override Future<String> turn({required String characterId,
      required String sessionId,required String text,required String requestId}) async
    => 'Answered';
  @override Future<void> hideSentTurn(String characterId,String requestId) async {
    if(failHide) throw DioException(requestOptions:RequestOptions(path:'/hide'));
    hidden.add(requestId);
  }
}
class ActionDrafts extends MasanaChatDraftStore {
  ActionDrafts():super(const FlutterSecureStorage());
  Map<String,dynamic>? data;
  @override Future<Map<String,dynamic>?> read(String a,String c) async=>data;
  @override Future<void> write(String a,String c,Map<String,dynamic> d) async {data=d;}
  @override Future<void> clear(String a,String c) async {data=null;}
}
void main() {
  testWidgets('C13 unavailable feature never offers a nonworking hide action', (tester) async {
    final api=ActionApi();
    final controller=MasanaChatController(api:api,drafts:ActionDrafts(),
      accountId:'fan-a',characterId:'character_0199f0d0-0000-7000-8000-000000000003');
    await tester.pumpWidget(MaterialApp(home:MasanaChatScreen(
      controller:controller,displayName:'Teacher')));
    await tester.enterText(find.byType(TextField),'hello');
    await tester.pump();
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Message actions').first);
    await tester.pumpAndSettle();
    expect(find.text('Reply'),findsWidgets);
    expect(find.text('Remove for me'),findsNothing);
    expect(api.hidden,isEmpty);
  });

  testWidgets('C13 quote and server-acknowledged hide', (tester) async {
    final api=ActionApi(),drafts=ActionDrafts();
    final controller=MasanaChatController(api:api,drafts:drafts,
      accountId:'fan-a',characterId:'character_0199f0d0-0000-7000-8000-000000000003');
    await tester.pumpWidget(MaterialApp(home:MasanaChatScreen(
      controller:controller,displayName:'Teacher',hideQualified:true)));
    await tester.enterText(find.byType(TextField),'hello');
    await tester.pump();
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Message actions').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reply').last);
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
      contains('> hello'));
    await tester.tap(find.byTooltip('Message actions').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove for me').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove').last);
    await tester.pumpAndSettle();
    expect(api.hidden,hasLength(1));
    expect(api.hidden.single,startsWith('request_'));
    expect(find.text('hello'),findsNothing);
    expect(drafts.data?['turns'],isEmpty);
  });
  testWidgets('C13 agent reply can be sent only to injected Gwani reporting journey', (tester) async {
    final api=ActionApi(),reported=<String>[];
    final controller=MasanaChatController(api:api,drafts:ActionDrafts(),
      accountId:'fan-a',characterId:'character_0199f0d0-0000-7000-8000-000000000003');
    await tester.pumpWidget(MaterialApp(home:MasanaChatScreen(
      controller:controller,displayName:'Teacher',
      onReportMessage:(id,body) async { reported.add(body); })));
    await tester.enterText(find.byType(TextField),'hello');
    await tester.pump();
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Masana reply actions'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Report to Gwani').last);
    await tester.pumpAndSettle();
    expect(reported,['Answered']);
  });
  testWidgets('C13 failed server hide does not discard the chat message', (tester) async {
    final api=ActionApi()..failHide=true;
    final controller=MasanaChatController(api:api,drafts:ActionDrafts(),
      accountId:'fan-a',characterId:'character_0199f0d0-0000-7000-8000-000000000003');
    await tester.pumpWidget(MaterialApp(home:MasanaChatScreen(
      controller:controller,displayName:'Teacher',hideQualified:true)));
    await tester.enterText(find.byType(TextField),'hello');
    await tester.pump();
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Message actions').first);
    await tester.pumpAndSettle();
    expect(find.text('Report to Gwani'),findsNothing);
    await tester.tap(find.text('Remove for me').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove').last);
    await tester.pumpAndSettle();
    expect(find.text('hello'),findsOneWidget);
    expect(api.hidden,isEmpty);
  });
}
