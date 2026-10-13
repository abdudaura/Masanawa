import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
void main(){
 test('signed-in server directory Room survives offline cache without inventing access',(){
  final original=AgentDirectoryEntry.fromJson({
   'characterId':'character_test_1','characterVersionId':'character-version_test_1',
   'displayName':'Dr. Amina Yusuf','roleLabel':'Medicine & Surgery',
   'presence':'available','roomId':'room_masana_02_amina',
  });
  expect(original.roomId,'room_masana_02_amina');
  final restored=AgentDirectoryEntry.fromJson(original.toJson()).withUnverifiedPresence();
  expect(restored.roomId,original.roomId);
  expect(restored.presence,AgentPresence.unknown);
  expect(AgentDirectoryEntry.fromJson({
   'characterId':'c','characterVersionId':'v','displayName':'Custom AI','roleLabel':'New',
   'roomId':'  ',
  }).roomId,isNull);
 });
}
