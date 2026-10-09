import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_composer_controller.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_draft_store.dart';

class MemoryDrafts implements HumanChatDraftStore {
  final values = <String, HumanChatDraft>{};
  bool refuse = false;
  @override Future<HumanChatDraft?> read(String key) async => values[key];
  @override Future<void> write(String key, HumanChatDraft value) async {
    if (refuse) throw StateError('keystore unavailable');
    values[key] = value;
  }
  @override Future<void> remove(String key) async {
    if (refuse) throw StateError('keystore unavailable');
    values.remove(key);
  }
}

class ServerPort implements HumanChatSendPort {
  int sends = 0, lookups = 0;
  bool failSend = false;
  bool wrongAck = false;
  Completer<HumanChatAccepted>? pending;
  final accepted = <String, HumanChatAccepted>{};
  final sentIds = <String>[];
  @override
  Future<HumanChatAccepted?> findServerAcknowledgement(
      String conversationId, String clientRequestId) async {
    lookups++;
    return accepted[clientRequestId];
  }
  @override
  Future<HumanChatAccepted> send(String conversationId,
      String clientRequestId, String body, {String? replyToMessageId}) async {
    sends++;
    sentIds.add(clientRequestId);
    if (pending != null) return pending!.future;
    if (failSend) throw StateError('lost response');
    final receipt = HumanChatAccepted(
      messageId: 'server-message',
      clientRequestId: wrongAck ? 'another-request' : clientRequestId);
    if (!wrongAck) accepted[clientRequestId] = receipt;
    return receipt;
  }
}

HumanChatComposerController buildController(
  MemoryDrafts drafts, ServerPort server, {
  String user = 'personA', String conversation = 'thread1',
}) => HumanChatComposerController(
  tenantId: 'tenant1', userId: user, conversationId: conversation,
  drafts: drafts, messages: server,
  requestIds: () => 'stable-request-key',
);

void main() {
  test('draft keys fence tenant/user/conversation and delimiter collisions', () {
    expect(humanDraftKey('ab', 'c', 'd'), isNot(humanDraftKey('a', 'bc', 'd')));
    expect(humanDraftKey('one', 'A', 'room'),
        isNot(humanDraftKey('one', 'B', 'room')));
    expect(() => humanDraftKey('', 'B', 'room'), throwsArgumentError);
  });

  test('protected draft rejects corrupt unpaired request fields', () {
    expect(() => HumanChatDraft.fromJson({
      'v': 1, 'text': 'hello', 'pendingId': 'id',
    }), throwsFormatException);
    expect(() => HumanChatDraft.fromJson({
      'v': 2, 'text': 'hello',
    }), throwsFormatException);
  });

  test('failed send survives restart and keeps same idempotency key', () async {
    final drafts = MemoryDrafts(), server = ServerPort()..failSend = true;
    final first = buildController(drafts, server);
    await first.restore();
    first.edit(' Hello Hausa 👋 ');
    expect(await first.submit(), isFalse);
    expect(first.phase, HumanChatPhase.uncertain);
    expect(drafts.values[first.key]!.pendingId, 'stable-request-key');
    first.dispose();

    server.failSend = false;
    final restored = buildController(drafts, server);
    await restored.restore();
    expect(restored.pendingBody, 'Hello Hausa 👋');
    expect(restored.hasPending, isTrue);
    expect(restored.canSend, isFalse);
    expect(await restored.retry(), isTrue);
    expect(server.sentIds, ['stable-request-key', 'stable-request-key']);
    expect(drafts.values.containsKey(restored.key), isFalse);
    expect(restored.notice, contains('Accepted by server'));
    restored.dispose();
  });

  test('lost send acknowledgement is found in server history, not resent', () async {
    final drafts = MemoryDrafts(), server = ServerPort()..failSend = true;
    final composer = buildController(drafts, server);
    await composer.restore(); composer.edit('Hi');
    expect(await composer.submit(), isFalse);
    server.accepted['stable-request-key'] = const HumanChatAccepted(
      messageId: 'authoritative-db-row', clientRequestId: 'stable-request-key');
    expect(await composer.retry(), isTrue);
    expect(server.sends, 1);
    expect(server.lookups, 2);
    composer.dispose();
  });

  test('duplicate tap cannot generate a second server request', () async {
    final drafts = MemoryDrafts(), server = ServerPort();
    server.pending = Completer<HumanChatAccepted>();
    final composer = buildController(drafts, server);
    await composer.restore(); composer.edit('Hello');
    final first = composer.submit();
    await Future<void>.delayed(const Duration(milliseconds: 1));
    expect(await composer.submit(), isFalse);
    expect(await composer.retry(), isFalse);
    expect(server.sends, 1);
    server.pending!.complete(const HumanChatAccepted(
      messageId: 'server-row', clientRequestId: 'stable-request-key'));
    expect(await first, isTrue);
    composer.dispose();
  });

  test('wrong server request ID never clears local uncertain draft', () async {
    final drafts = MemoryDrafts(), server = ServerPort()..wrongAck = true;
    final composer = buildController(drafts, server);
    await composer.restore(); composer.edit('Hello');
    expect(await composer.submit(), isFalse);
    expect(composer.pendingId, 'stable-request-key');
    expect(drafts.values[composer.key]!.pendingBody, 'Hello');
    composer.dispose();
  });

  test('keystore write failure refuses to send, never falls back plaintext', () async {
    final drafts = MemoryDrafts(), server = ServerPort();
    final composer = buildController(drafts, server);
    await composer.restore(); composer.edit('secret');
    drafts.refuse = true;
    expect(await composer.submit(), isFalse);
    expect(server.sends, 0);
    expect(composer.notice, contains('No message was sent'));
    composer.dispose();
  });

  test('account switch cannot restore a different user draft', () async {
    final drafts = MemoryDrafts(), server = ServerPort();
    final a = buildController(drafts, server);
    await a.restore(); a.edit('A private draft');
    await Future<void>.delayed(const Duration(milliseconds: 1));
    final b = buildController(drafts, server, user: 'personB');
    await b.restore();
    expect(b.text, isEmpty);
    a.dispose(); b.dispose();
  });

  test('revoked contact permission prevents send and pending retry', () async {
    final drafts = MemoryDrafts(), server = ServerPort();
    final composer = buildController(drafts, server);
    await composer.restore(); composer.edit('Hello');
    composer.setPermission(false);
    expect(await composer.submit(), isFalse);
    expect(server.sends, 0);
    composer.dispose();
  });
  test('explicit discard removes old request and text to prevent easy duplicate', () async {
    final drafts = MemoryDrafts(), server = ServerPort()..failSend = true;
    final composer = buildController(drafts, server);
    await composer.restore(); composer.edit('uncertain body');
    expect(await composer.submit(), isFalse);
    expect(await composer.abandonUnconfirmed(), isTrue);
    expect(composer.text, isEmpty);
    expect(composer.pendingId, isNull);
    expect(composer.canSend, isFalse);
    expect(drafts.values.containsKey(composer.key), isFalse);
    composer.dispose();
  });

  test('sign-out wipes only the active account and fences future sends', () async {
    final drafts = MemoryDrafts(), server = ServerPort();
    final a = buildController(drafts, server);
    final b = buildController(drafts, server, user: 'personB');
    await a.restore(); await b.restore();
    a.edit('A secret'); b.edit('B secret');
    await Future<void>.delayed(const Duration(milliseconds: 1));
    await a.revokeSessionAndPurge();
    expect(drafts.values.containsKey(a.key), isFalse);
    expect(drafts.values[b.key]?.text, 'B secret');
    expect(await a.submit(), isFalse);
    expect(server.sends, 0);
    a.dispose(); b.dispose();
  });

  test('lost reply capability cannot transform a pending reply into plain text', () async {
    final drafts = MemoryDrafts(), server = ServerPort();
    final composer = buildController(drafts, server);
    drafts.values[composer.key] = const HumanChatDraft(
      text: 'private response',
      pendingId: 'old-request', pendingBody: 'private response',
      pendingReplyId: 'specific-original',
    );
    await composer.restore();
    expect(composer.canRetry, isFalse);
    expect(await composer.retry(), isFalse);
    expect(server.sends, 0);
    expect(composer.notice, contains('Reply support changed'));
    composer.dispose();
  });

}
