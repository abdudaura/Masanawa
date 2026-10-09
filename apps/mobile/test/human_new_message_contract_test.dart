import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/messages/human_new_message_screen.dart';

void main() {
  test('human recipient discovery uses exact normalized handles only', () {
    expect(normalizeHumanRecipientHandle(' @Amina.bello '), 'amina.bello');
    expect(normalizeHumanRecipientHandle('my_handle'), 'my_handle');
    expect(normalizeHumanRecipientHandle('A'), isNull);
    expect(normalizeHumanRecipientHandle(''), isNull);
    expect(normalizeHumanRecipientHandle('user@domain.com'), isNull);
    expect(normalizeHumanRecipientHandle('../admin'), isNull);
    expect(normalizeHumanRecipientHandle('character_abc/123'), isNull);
    expect(normalizeHumanRecipientHandle('alice?role=admin'), isNull);
    expect(normalizeHumanRecipientHandle('älice'), isNull);
    expect(normalizeHumanRecipientHandle(List.filled(41, 'a').join()), isNull);
  });

  test('only canonical DM UUIDs become conversation route segments', () {
    expect(validHumanConversationId('104329db-0d8c-48a9-bc37-a9f56311e17d'), isTrue);
    expect(validHumanConversationId('104329DB-0D8C-48A9-BC37-A9F56311E17D'), isTrue);
    expect(validHumanConversationId('character_abc'), isFalse);
    expect(validHumanConversationId('thread/one'), isFalse);
    expect(validHumanConversationId('104329db-0d8c-48a9-bc37-a9f56311e17d?admin=1'), isFalse);
    expect(validHumanConversationId('00000000-0000-0000-0000-00000000000g'), isFalse);
  });
}
