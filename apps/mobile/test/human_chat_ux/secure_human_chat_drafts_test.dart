import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_chat_ux/human_chat_contract.dart';
import 'package:masanawa/src/human_chat_ux/secure_human_chat_drafts.dart';
import 'package:mocktail/mocktail.dart';

class MockSecureStorage extends Mock implements FlutterSecureStorage {}

const alice = HumanChatScope(
  tenantId: 'tenant-a',
  userId: 'alice',
  conversationId: 'thread-1',
);
const bob = HumanChatScope(
  tenantId: 'tenant-a',
  userId: 'bob',
  conversationId: 'thread-1',
);

void main() {
  late MockSecureStorage secure;
  late Map<String, String> saved;
  late SecureHumanChatDraftStore drafts;

  setUp(() {
    secure = MockSecureStorage();
    saved = <String, String>{};
    when(() => secure.read(key: any(named: 'key'))).thenAnswer(
      (invocation) async =>
          saved[invocation.namedArguments[#key] as String],
    );
    when(() => secure.write(
          key: any(named: 'key'),
          value: any(named: 'value'),
        )).thenAnswer((invocation) async {
      final key = invocation.namedArguments[#key] as String;
      saved[key] = invocation.namedArguments[#value] as String;
    });
    when(() => secure.delete(key: any(named: 'key'))).thenAnswer(
      (invocation) async {
        saved.remove(invocation.namedArguments[#key] as String);
      },
    );
    drafts = SecureHumanChatDraftStore(storage: secure);
  });

  test('drafts and pending send IDs are scoped per verified account', () async {
    await drafts.write(alice, const HumanChatDraft(
      text: 'Alice only',
      pendingRequestId: 'request_1',
      pendingText: 'Alice only',
    ));
    expect((await drafts.read(alice))!.pendingRequestId, 'request_1');
    expect(await drafts.read(bob), isNull);
    await drafts.write(bob, const HumanChatDraft(text: 'Bob only'));
    await drafts.clearAccount(alice.tenantId, alice.userId);
    expect(await drafts.read(alice), isNull);
    expect((await drafts.read(bob))!.text, 'Bob only');
    verifyNever(() => secure.deleteAll());
  });

  test('bounded per-account storage evicts old drafts but not other user', () async {
    await drafts.write(bob, const HumanChatDraft(text: 'Bob'));
    for (var index = 0; index < 18; index++) {
      await drafts.write(HumanChatScope(
        tenantId: alice.tenantId,
        userId: alice.userId,
        conversationId: 'thread-$index',
      ), HumanChatDraft(text: 'draft $index'));
    }
    expect(await drafts.read(HumanChatScope(
      tenantId: alice.tenantId,
      userId: alice.userId,
      conversationId: 'thread-0',
    )), isNull);
    expect((await drafts.read(HumanChatScope(
      tenantId: alice.tenantId,
      userId: alice.userId,
      conversationId: 'thread-17',
    )))!.text, 'draft 17');
    expect((await drafts.read(bob))!.text, 'Bob');
  });

  test('corrupt secure storage fails closed instead of deleting data', () async {
    await drafts.write(alice, const HumanChatDraft(text: 'safe'));
    final key = saved.keys.single;
    saved[key] = '{"v":999,"threads":{}}';
    await expectLater(drafts.read(alice), throwsFormatException);
    expect(saved[key], '{"v":999,"threads":{}}');
  });
}
