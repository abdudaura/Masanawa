import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_composer.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_composer_controller.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_draft_store.dart';

class TestDrafts implements HumanChatDraftStore {
  final values = <String, HumanChatDraft>{};
  @override Future<HumanChatDraft?> read(String key) async => values[key];
  @override Future<void> write(String key, HumanChatDraft value) async {
    values[key] = value;
  }
  @override Future<void> remove(String key) async { values.remove(key); }
}

class TestMessages implements HumanChatSendPort {
  bool offline = false;
  final ids = <String>[];
  @override
  Future<HumanChatAccepted?> findServerAcknowledgement(
      String conversationId, String clientRequestId) async => null;
  @override
  Future<HumanChatAccepted> send(String conversationId,
      String clientRequestId, String body, {String? replyToMessageId}) async {
    ids.add(clientRequestId);
    if (offline) throw StateError('offline');
    return HumanChatAccepted(
        messageId: 'server-record', clientRequestId: clientRequestId);
  }
}

HumanChatComposerController create(TestDrafts drafts, TestMessages messages,
    {String userId = 'a'}) => HumanChatComposerController(
  tenantId: 'tenant', userId: userId, conversationId: 'conversation',
  drafts: drafts, messages: messages, requestIds: () => 'one-request-id',
);

Widget host(HumanChatComposerController controller, {
  Future<void> Function()? voice, VoidCallback? attach,
}) => MaterialApp(home: Scaffold(
  body: Column(children: [
    const Expanded(child: SizedBox()),
    HumanChatComposer(controller: controller,
        onVoiceNote: voice, onAttachment: attach),
  ]),
));

void main() {
  testWidgets('send is disabled for empty text; voice appears only if real handler',
      (tester) async {
    final controller = create(TestDrafts(), TestMessages());
    var recordings = 0;
    await tester.pumpWidget(host(controller,
        voice: () async { recordings++; }));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('u10-voice')), findsOneWidget);
    expect(find.byKey(const ValueKey('u10-send')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('u10-voice')));
    await tester.pump();
    expect(recordings, 1);
    await tester.enterText(find.byKey(const ValueKey('u10-human-text')), 'Hello!');
    await tester.pump();
    expect(find.byKey(const ValueKey('u10-voice')), findsNothing);
    expect(find.byKey(const ValueKey('u10-send')), findsOneWidget);
    controller.dispose();
  });

  testWidgets('server accepted is never mislabeled delivered or read',
      (tester) async {
    final drafts = TestDrafts(), messages = TestMessages();
    final controller = create(drafts, messages);
    await tester.pumpWidget(host(controller));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('u10-human-text')), 'Hello');
    await tester.tap(find.byKey(const ValueKey('u10-send')));
    await tester.pumpAndSettle();
    expect(messages.ids, ['one-request-id']);
    expect(find.textContaining('Accepted by server'), findsOneWidget);
    expect(find.textContaining('delivery and read not confirmed'), findsOneWidget);
    expect(controller.hasPending, isFalse);
    controller.dispose();
  });

  testWidgets('uncertain retry reuses identity and local discard is explicit',
      (tester) async {
    final drafts = TestDrafts(), messages = TestMessages()..offline = true;
    final controller = create(drafts, messages);
    await tester.pumpWidget(host(controller));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('u10-human-text')), 'Hello');
    await tester.tap(find.byKey(const ValueKey('u10-send')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('u10-uncertain')), findsOneWidget);
    expect(find.byKey(const ValueKey('u10-retry')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('u10-retry')));
    await tester.pumpAndSettle();
    expect(messages.ids, ['one-request-id', 'one-request-id']);
    await tester.tap(find.byKey(const ValueKey('u10-discard')));
    await tester.pumpAndSettle();
    expect(find.textContaining('may already have accepted'), findsOneWidget);
    await tester.tap(find.text('Keep pending'));
    await tester.pumpAndSettle();
    expect(controller.hasPending, isTrue);
    await tester.tap(find.byKey(const ValueKey('u10-discard')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Discard locally').last);
    await tester.pumpAndSettle();
    expect(controller.hasPending, isFalse);
    controller.dispose();
  });

  testWidgets('draft restore stays scoped to account and composer is bounded',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final drafts = TestDrafts(), messages = TestMessages();
    final a = create(drafts, messages);
    await tester.pumpWidget(host(a));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('u10-human-text')),
        'A private draft');
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
    a.dispose();
    final b = create(drafts, messages, userId: 'b');
    await tester.pumpWidget(host(b));
    await tester.pumpAndSettle();
    expect(find.text('A private draft'), findsNothing);
    expect(tester.takeException(), isNull);
    b.dispose();
  });
}
