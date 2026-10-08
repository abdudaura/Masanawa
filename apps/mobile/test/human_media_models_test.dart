import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/human_media/human_voice_models.dart';

void main(){
 const valid={
  'messageId':'00000000-0000-4000-8000-000000000002',
  'conversationId':'00000000-0000-4000-8000-000000000001',
  'sequence':'15',
  'senderUserId':'user-alice',
  'clientRequestId':'requestABCDEFGHIJKLMNOP',
  'durationMs':1750,'sizeBytes':1234,'mimeType':'audio/ogg',
  'createdAt':'2026-10-08T11:59:00Z','deletedAt':null,
 };
 test('accepts exact server voice receipt and immutable metadata',(){
  final note=HumanVoiceNote.fromJson(valid);
  expect(note.sequence,'15');expect(note.durationMs,1750);
 });
 test('does not treat tombstone or malformed payload as playable',(){
  for(final changed in [
    {'deletedAt':'2026-10-08T12:00:00Z'},
    {'mimeType':'image/png'},
    {'durationMs':90001},
    {'sizeBytes':1536*1024+1},
    {'sequence':'0'},
    {'senderUserId':null},
  ]){
   expect(()=>HumanVoiceNote.fromJson({...valid,...changed}),throwsFormatException);
  }
 });
}
