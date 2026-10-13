import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/commerce/wallet_models.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/voice_note_recorder.dart';
import 'package:masanawa/src/screens/chat/ai_chat_screen.dart';
import 'package:masanawa/src/state/ai_chat_state.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';
import 'package:masanawa/src/ui/components/voice_note_composer.dart';
class _Native extends Mock implements AudioRecorder {}
class _Recorder extends VoiceNoteRecorder {
 _Recorder():super(recorder:_Native());
 var retained=false;
 @override Future<void> start({bool Function()? isOwnerCurrent}) async {state=VoiceNoteState.recording;notifyListeners();}
 @override Future<ChatAttachment?> stop() async {state=VoiceNoteState.ready;note=const ChatAttachment(kind:'voice',path:'/private/note.m4a',durationMs:1000,sizeBytes:42);notifyListeners();return note;}
 @override Future<void> cancel() async {state=VoiceNoteState.idle;notifyListeners();}
 @override Future<void> close() async {}
 @override void retain(){retained=true;}
}
class _Chats extends AiChatController {
 final sent=<ChatAttachment>[];
 @override AiChatState build()=>const AiChatState();
 @override void openThread(String characterId) {}
 @override void closeThread() {}
 @override Future<void> sendAttachment(String characterId,ChatAttachment attachment,{String? caption,String? replyToId,String? replyPreview}) async {sent.add(attachment);}
}
class _Directory extends AgentDirectoryController {
 @override AgentDirectoryState build()=>const AgentDirectoryState(loading:false,agents:[AgentDirectoryEntry(characterId:'agent',characterVersionId:'v1',displayName:'Amina',roleLabel:'AI',about:'',presence:AgentPresence.available,supportAgent:true)]);
 @override Future<void> refresh() async {}
}
const _user=AuthUser(id:'account-a',name:'Fan',locale:'en',status:'ACTIVE',role:'USER',isNewUser:false,createdAt:'2026-10-12');
const _tokens=AuthTokens(accessToken:'test',refreshToken:'test-refresh',accessExpiresIn:3600,user:_user);
class _Session extends SessionController {
 @override SessionState build()=>const SessionSignedIn(_user,_tokens);
}
class _Wallet extends WalletController {
 @override Future<WalletView?> build() async=>null;
 @override Future<void> refresh() async {}
}
void main() {
 testWidgets('chat microphone records and sends a voice note, never requests a call permission', (tester) async {
  var callPermissionRequests=0;
  const channel=MethodChannel('flutter.baseflow.com/permissions/methods');
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel,(call) async {callPermissionRequests++;return 1;});
  addTearDown(()=>tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(channel,null));
  final chats=_Chats();final recorder=_Recorder();
  await tester.pumpWidget(ProviderScope(overrides:[aiChatProvider.overrideWith(()=>chats),agentDirectoryProvider.overrideWith(_Directory.new),sessionProvider.overrideWith(_Session.new),walletProvider.overrideWith(_Wallet.new),voiceNoteRecorderFactoryProvider.overrideWithValue(()=>recorder)],child:MaterialApp(theme:buildMasanawaTheme(brightness:Brightness.light),home:const AiChatScreen(characterId:'agent'))));
  await tester.pumpAndSettle();
  await tester.tap(find.bySemanticsLabel('Record voice note'));await tester.pumpAndSettle();
  expect(find.text('Recording voice note'),findsOneWidget);
  expect(callPermissionRequests,0);
  await tester.tap(find.text('Send voice note'));await tester.pumpAndSettle();
  expect(chats.sent,hasLength(1));expect(chats.sent.single.kind,'voice');expect(recorder.retained,true);
  expect(find.text('Recording voice note'),findsNothing);
  expect(tester.takeException(),isNull);
 });
}
