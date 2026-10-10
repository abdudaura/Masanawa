import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_composer.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_composer_controller.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_contract.dart';

const scope = HumanChatScope(
  tenantId: 'tenant',
  userId: 'account',
  conversationId: 'thread',
);

class Drafts implements HumanChatDraftStore {
  HumanChatDraft? value;
  @override Future<HumanChatDraft?> read(HumanChatScope s) async => value;
  @override Future<void> write(HumanChatScope s, HumanChatDraft v) async {
    value = v;
  }
  @override Future<void> remove(HumanChatScope s) async { value = null; }
  @override Future<void> clearAccount(String t, String u) async { value = null; }
}

class Sender implements HumanChatSendPort {
  bool error = false;
  int sends = 0;
  @override bool get supportsReply => false;
  @override
  Future<HumanChatServerAck> send({
    required HumanChatScope scope,
    required String clientRequestId,
    required String text,
    String? replyToMessageId,
  }) async {
    sends++;
    if (error) throw StateError('offline');
    return HumanChatServerAck(
      conversationId: scope.conversationId,
      clientRequestId: clientRequestId,
      messageId: 'server-id',
    );
  }
}

void main() {
  testWidgets('compact 320dp chat toggles mic and send and inserts emoji',
      (tester) async {
    final drafts = Drafts();
    final sender = Sender();
    final c = HumanChatComposerController(
      scope: scope,
      drafts: drafts,
      sender: sender,
      isAuthorized: (_) => true,
    );
    var voiceTaps = 0;
    await tester.binding.setSurfaceSize(const Size(320, 640));
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: Align(
          alignment: Alignment.bottomCenter,
          child: HumanChatComposer(
            controller: c,
            onVoiceNote: (_) async { voiceTaps++; },
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byTooltip('Record voice note'), findsOneWidget);
    await tester.tap(find.byTooltip('Record voice note'));
    expect(voiceTaps, 1);

    await tester.tap(find.byTooltip('Insert emoji'));
    await tester.pump();
    await tester.tap(find.text('😀'));
    await tester.pump();
    expect(find.byTooltip('Send text message'), findsOneWidget);
    expect(find.byTooltip('Record voice note'), findsNothing);
    await tester.tap(find.byTooltip('Send text message'));
    await tester.pumpAndSettle();
    expect(sender.sends, 1);
    expect(find.byTooltip('Record voice note'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
    await tester.binding.setSurfaceSize(null);
  });

  testWidgets('uncertain send has explicit same-message retry', (tester) async {
    final drafts = Drafts();
    final sender = Sender()..error = true;
    final c = HumanChatComposerController(
      scope: scope,
      drafts: drafts,
      sender: sender,
      isAuthorized: (_) => true,
    );
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: HumanChatComposer(controller: c)),
    ));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'hello friend');
    await tester.tap(find.byTooltip('Send text message'));
    await tester.pumpAndSettle();
    expect(find.text('Retry same message'), findsOneWidget);
    expect(find.textContaining('Not confirmed by server'), findsOneWidget);
    final request = drafts.value!.pendingRequestId;
    sender.error = false;
    await tester.tap(find.text('Retry same message'));
    await tester.pumpAndSettle();
    expect(sender.sends, 2);
    expect(drafts.value!.pendingRequestId, isNull);
    expect(request, isNotNull);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
}
