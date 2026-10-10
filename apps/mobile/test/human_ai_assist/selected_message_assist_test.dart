import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_ai_assist/selected_message_assist.dart';
import 'package:masanawa/src/human_ai_assist/selected_message_assist_sheet.dart';

class SpyHumanAiTransport implements HumanAiAssistTransport {
  int prepared=0, sent=0;
  bool shouldFailSend=false;
  String? lastToken, lastRecipient, lastBody;
  @override
  Future<HumanAiPreview> prepare({
    required String conversationId,required List<String> messageIds,
    required HumanAiAssistPurpose purpose,required String language,
    required bool maskPrivateNumbers,
  }) async {
    prepared++;
    return HumanAiPreview(text:'A private suggestion',purpose:purpose,
      peerUserId:'human-B', reviewToken:purpose==HumanAiAssistPurpose.reply?'signed-token':null,
      expiresAt:DateTime.now().add(const Duration(minutes:5)));
  }
  @override
  Future<String> sendReviewed({required String reviewToken,
    required String recipientUserId,required String reviewedBody}) async {
    sent++;
    lastToken=reviewToken;lastRecipient=recipientUserId;lastBody=reviewedBody;
    if(shouldFailSend) throw Exception('network did not confirm');
    return 'authoritative-message-id';
  }
}
SelectedMessageAssistController make(SpyHumanAiTransport spy) =>
    SelectedMessageAssistController(transport:spy,
      conversationId:'conversation-1',messageIds:const ['message-1'],
      recipientUserId:'human-B',accountKey:'account-A');

void main() {
  test('disclosure required before transport sees any selected message',() async {
    final spy=SpyHumanAiTransport(), c=make(spy);
    await c.prepare(purpose:HumanAiAssistPurpose.reply,language:'ha',
      disclosureAccepted:false,maskPrivateNumbers:true);
    expect(spy.prepared,0);
    expect(c.phase,HumanAiAssistPhase.choose);
    c.dispose();
  });

  test('separate reviewed recipient confirmation gates a canonical send',() async {
    final spy=SpyHumanAiTransport(), c=make(spy);
    await c.prepare(purpose:HumanAiAssistPurpose.reply,language:'ha',
      disclosureAccepted:true,maskPrivateNumbers:true);
    expect(c.canSend,isTrue);
    await c.send(recipientAndTextConfirmed:false);
    expect(spy.sent,0);
    c.changeReviewedText('Edited by a human');
    await c.send(recipientAndTextConfirmed:true);
    expect(c.phase,HumanAiAssistPhase.sent);
    expect(spy.sent,1);
    expect(spy.lastRecipient,'human-B');
    expect(spy.lastBody,'Edited by a human');
    c.dispose();
  });

  test('uncertain send retry reuses signed token and unchanged reviewed text',() async {
    final spy=SpyHumanAiTransport()..shouldFailSend=true, c=make(spy);
    await c.prepare(purpose:HumanAiAssistPurpose.reply,language:'en',
      disclosureAccepted:true,maskPrivateNumbers:true);
    await c.send(recipientAndTextConfirmed:true);
    expect(c.phase,HumanAiAssistPhase.uncertain);
    expect(c.sentMessageId,isNull);
    final priorToken=spy.lastToken, priorBody=spy.lastBody;
    spy.shouldFailSend=false;
    await c.retryUncertain(recipientAndTextConfirmed:true);
    expect(c.phase,HumanAiAssistPhase.sent);
    expect(spy.sent,2);
    expect(spy.lastToken,priorToken);
    expect(spy.lastBody,priorBody);
    c.dispose();
  });

  test('account switch purges review token and transient contents',() async {
    final spy=SpyHumanAiTransport(), c=make(spy);
    await c.prepare(purpose:HumanAiAssistPurpose.reply,language:'ha',
      disclosureAccepted:true,maskPrivateNumbers:true);
    c.clearSession('account-B');
    expect(c.preview,isNull);
    expect(c.reviewedText,isEmpty);
    expect(c.canSend,isFalse);
    await c.send(recipientAndTextConfirmed:true);
    expect(spy.sent,0);
    c.dispose();
  });

  test('translations never enable direct person-message sending',() async {
    final spy=SpyHumanAiTransport(), c=make(spy);
    await c.prepare(purpose:HumanAiAssistPurpose.translate,language:'ha',
      disclosureAccepted:true,maskPrivateNumbers:true);
    expect(c.phase,HumanAiAssistPhase.review);
    expect(c.canSend,isFalse);
    await c.send(recipientAndTextConfirmed:true);
    expect(spy.sent,0);
    c.dispose();
  });

  testWidgets('editing or discarding revokes the old exact-text approval',(tester) async {
    final spy=SpyHumanAiTransport(), c=make(spy);
    await tester.pumpWidget(MaterialApp(home:Scaffold(
      body:SelectedMessageAssistSheet(controller:c,recipientLabel:'Human B'))));
    await c.prepare(purpose:HumanAiAssistPurpose.reply,language:'ha',
      disclosureAccepted:true,maskPrivateNumbers:true);
    await tester.pumpAndSettle();
    final checkbox=find.text('I verified the recipient and exact text');
    await tester.ensureVisible(checkbox);
    await tester.tap(checkbox);
    await tester.pump();
    expect(tester.widget<FilledButton>(
      find.widgetWithText(FilledButton,'Send reviewed reply')).onPressed,isNotNull);
    await tester.enterText(find.byType(TextField),'Changed since review');
    await tester.pump();
    expect(tester.widget<FilledButton>(
      find.widgetWithText(FilledButton,'Send reviewed reply')).onPressed,isNull);
    expect(spy.sent,0);
    c.discard();
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(
      find.widgetWithText(FilledButton,'Prepare private preview')).onPressed,isNull);
    await tester.pumpWidget(const MaterialApp(home:SizedBox()));
    c.dispose();
  });

  testWidgets('sheet blocks AI preview until explicit selection disclosure',(tester) async {
    final spy=SpyHumanAiTransport(), c=make(spy);
    await tester.pumpWidget(MaterialApp(home:Scaffold(
      body:SelectedMessageAssistSheet(controller:c,recipientLabel:'Human B'))));
    expect(find.textContaining('Only these messages'),findsOneWidget);
    expect(find.text('Prepare private preview'),findsOneWidget);
    final before=tester.widget<FilledButton>(find.widgetWithText(FilledButton,'Prepare private preview'));
    expect(before.onPressed,isNull);
    expect(spy.prepared,0);
    await tester.tap(find.text('I consent to process only my selected messages with AI'));
    await tester.pump();
    await tester.tap(find.text('Prepare private preview'));
    await tester.pumpAndSettle();
    expect(spy.prepared,1);
    expect(find.textContaining('Recipient: Human B'),findsOneWidget);
    final send=tester.widget<FilledButton>(find.widgetWithText(FilledButton,'Send reviewed reply'));
    expect(send.onPressed,isNull);
    await tester.pumpWidget(const MaterialApp(home:SizedBox()));
    c.dispose();
  });
}
