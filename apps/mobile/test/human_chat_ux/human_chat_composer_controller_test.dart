import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_composer_controller.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_contract.dart';

const a = HumanChatScope(
  tenantId: 'tenant-a',
  userId: 'user-a',
  conversationId: 'conversation-1',
);
const b = HumanChatScope(
  tenantId: 'tenant-a',
  userId: 'user-b',
  conversationId: 'conversation-1',
);

class MemoryDrafts implements HumanChatDraftStore {
  final data = <String, HumanChatDraft>{};
  bool rejectWrites = false;
  String key(HumanChatScope s) =>
      '${s.tenantId}:${s.userId}:${s.conversationId}';
  @override
  Future<HumanChatDraft?> read(HumanChatScope scope) async => data[key(scope)];
  @override
  Future<void> write(HumanChatScope scope, HumanChatDraft value) async {
    if (rejectWrites) throw StateError('key store unavailable');
    data[key(scope)] = value;
  }
  @override
  Future<void> remove(HumanChatScope scope) async {
    data.remove(key(scope));
  }
  @override
  Future<void> clearAccount(String tenantId, String userId) async {
    data.removeWhere((k, _) => k.startsWith('$tenantId:$userId:'));
  }
}

class Remote implements HumanChatSendPort {
  int attempts = 0;
  final ids = <String>[];
  bool fail = false;
  bool mismatch = false;
  bool allowReplies = false;
  Completer<void>? hold;
  @override
  bool get supportsReply => allowReplies;
  @override
  Future<HumanChatServerAck> send({
    required HumanChatScope scope,
    required String clientRequestId,
    required String text,
    String? replyToMessageId,
  }) async {
    attempts++;
    ids.add(clientRequestId);
    if (hold != null) await hold!.future;
    if (fail) throw const FormatException('response lost');
    return HumanChatServerAck(
      conversationId: scope.conversationId,
      clientRequestId: mismatch ? 'request_wrong' : clientRequestId,
      messageId: 'server-message-1',
    );
  }
}

HumanChatComposerController build(
  MemoryDrafts drafts,
  Remote server, {
  HumanChatScope scope = a,
  bool Function(HumanChatScope)? authorized,
}) =>
    HumanChatComposerController(
      scope: scope,
      drafts: drafts,
      sender: server,
      isAuthorized: authorized ?? (_) => true,
    );

void main() {
  test('same persisted ID after timeout and controller recreation', () async {
    final drafts = MemoryDrafts();
    final server = Remote()..fail = true;
    final first = build(drafts, server);
    await first.load();
    first.updateText('hello 👋');
    expect(await first.submit(), isFalse);
    final id = first.pendingRequestId;
    expect(id, startsWith('request_'));
    expect(drafts.data[drafts.key(a)]!.pendingRequestId, id);
    first.dispose();

    server.fail = false;
    final restarted = build(drafts, server);
    await restarted.load();
    expect(restarted.pendingRequestId, id);
    expect(restarted.pendingText, 'hello 👋');
    expect(await restarted.submit(), isTrue);
    expect(server.ids, [id, id]);
    expect(drafts.data[drafts.key(a)]!.pendingRequestId, isNull);
    expect(restarted.text, isEmpty);
    restarted.dispose();
  });

  test('simultaneous submit taps send only once', () async {
    final drafts = MemoryDrafts();
    final server = Remote()..hold = Completer<void>();
    final controller = build(drafts, server);
    await controller.load();
    controller.updateText('one');
    final first = controller.submit();
    expect(await controller.submit(), isFalse);
    server.hold!.complete();
    expect(await first, isTrue);
    expect(server.attempts, 1);
    controller.dispose();
  });

  test('local storage failure prevents network call', () async {
    final drafts = MemoryDrafts()..rejectWrites = true;
    final server = Remote();
    final controller = build(drafts, server);
    await controller.load();
    controller.updateText('must not send');
    expect(await controller.submit(), isFalse);
    expect(server.attempts, 0);
    controller.dispose();
  });

  test('forged ACK stays uncertain, never appears delivered', () async {
    final drafts = MemoryDrafts();
    final server = Remote()..mismatch = true;
    final controller = build(drafts, server);
    await controller.load();
    controller.updateText('hello');
    expect(await controller.submit(), isFalse);
    expect(controller.hasPending, isTrue);
    expect(controller.error, contains('Not confirmed'));
    controller.dispose();
  });

  test('sign-out during send ignores late ACK and blocks new sends', () async {
    final drafts = MemoryDrafts();
    final server = Remote()..hold = Completer<void>();
    var active = true;
    final controller = build(drafts, server, authorized: (_) => active);
    await controller.load();
    controller.updateText('private');
    final sending = controller.submit();
    await Future<void>.delayed(Duration.zero);
    active = false;
    server.hold!.complete();
    expect(await sending, isFalse);
    expect(controller.canSubmit, isFalse);
    controller.dispose();
  });

  test('separate identities, purged account, no cross-user drafts', () async {
    final drafts = MemoryDrafts();
    final server = Remote();
    final alice = build(drafts, server);
    await alice.load();
    alice.updateText('private Alice');
    await Future<void>.delayed(Duration.zero);
    final bob = build(drafts, server, scope: b);
    await bob.load();
    expect(bob.text, isEmpty);
    await alice.purgeAccount();
    expect(drafts.data[drafts.key(a)], isNull);
    expect(drafts.data[drafts.key(b)], isNull);
    alice.dispose();
    bob.dispose();
  });

  test('quote is capability gated and tombstone clears preview', () async {
    final drafts = MemoryDrafts();
    final server = Remote()..allowReplies = true;
    final controller = build(drafts, server);
    await controller.load();
    controller.setQuote(const HumanChatReplyQuote(
      messageId: 'm1',
      preview: 'old text',
      revision: '2',
    ));
    expect(controller.quote?.preview, 'old text');
    controller.invalidateQuote('m1');
    expect(controller.quote, isNull);
    controller.dispose();
  });

  test('saved draft parser rejects corrupt or inconsistent pending ID', () {
    expect(
      () => HumanChatDraft.fromJson({
        'text': 'message',
        'pendingRequestId': 'request_x',
        'pendingText': null,
      }),
      throwsFormatException,
    );
    expect(
      () => HumanChatDraft.fromJson({
        'text': List<String>.filled(4001, 'x').join(),
      }),
      throwsFormatException,
    );
  });
}
