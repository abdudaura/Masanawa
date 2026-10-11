import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:masanawa/src/features/masana_chat/masana_chat_api.dart';
import 'package:masanawa/src/features/masana_chat/masana_chat_controller.dart';
import 'package:masanawa/src/features/masana_chat/masana_chat_screen.dart';

class FakeChatApi extends MasanaChatApi {
  FakeChatApi():super(Dio());
  final requests=<String>[];
  @override
  Future<String> open(String id) async =>
      'character-session_0199f0d0-0000-7000-8000-000000000001';
  @override
  Future<String> turn({
    required String characterId,required String sessionId,
    required String text,required String requestId,
  }) async {
    requests.add(requestId);
    return 'Hello from Masana';
  }
}
class MemoryDrafts extends MasanaChatDraftStore {
  MemoryDrafts():super(const FlutterSecureStorage());
  Map<String,dynamic>? snapshot;
  @override
  Future<Map<String,dynamic>?> read(String a,String c) async=>snapshot;
  @override
  Future<void> write(String a,String c,Map<String,dynamic> data) async {
    snapshot=data;
  }
  @override
  Future<void> clear(String a,String c) async { snapshot=null; }
}
void main(){
  testWidgets('J03 new message, persisted reply and canonical id',
      (tester) async {
    final api=FakeChatApi(), drafts=MemoryDrafts();
    final controller=MasanaChatController(
      api:api,drafts:drafts,accountId:'fan-a',characterId:'character-x');
    await tester.pumpWidget(MaterialApp(home:MasanaChatScreen(
      controller:controller,displayName:'Teacher')));
    await tester.enterText(find.byType(TextField),'Hi');
    // TextField changes schedule a frame: assert the Mic-to-Send visual
    // transition after that frame, not against the pre-edit tree.
    await tester.pump();
    expect(find.byTooltip('Send message'), findsOneWidget);
    await tester.tap(find.byTooltip('Send message'));
    await tester.pumpAndSettle();
    expect(find.text('Hi'),findsOneWidget);
    expect(find.text('Hello from Masana'),findsOneWidget);
    expect(api.requests.single,startsWith('request_'));
    expect(newMasanaRequestId(),matches(RegExp(
      r'^request_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    expect(drafts.snapshot?['turns'],isNotEmpty);
  });
}
