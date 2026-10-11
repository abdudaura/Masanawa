import 'package:dio/dio.dart';

class SavedRoomLesson {
 const SavedRoomLesson({required this.id,required this.body,required this.kind,required this.bookmarkedAt});
 final String id,body,kind;
 final DateTime bookmarkedAt;
 factory SavedRoomLesson.fromJson(Map<String,dynamic> data) {
  final id=data['lessonId'],body=data['body'],kind=data['kind'],time=data['bookmarkedAt'];
  final when=DateTime.tryParse(time is String?time:'');
  if(id is! String||!id.startsWith('room-lesson_')||body is! String||
   (kind!='lesson'&&kind!='announcement')||when==null) {
    throw const FormatException('Invalid saved Room lesson');
  }
  return SavedRoomLesson(id:id,body:body,kind:kind as String,bookmarkedAt:when);
 }
}
abstract class SavedLessonsClient {
 bool get isCurrentAccount;
 Future<List<SavedRoomLesson>> list(String roomId);
 Future<void> save(String roomId,String lessonId);
 Future<void> remove(String roomId,String lessonId);
}
/// Uses the app's existing authenticated Dio and account epoch; never passes fan IDs.
class DioSavedLessonsClient implements SavedLessonsClient {
 const DioSavedLessonsClient({required this.dio,required this.accountKey,required this.currentAccountKey});
 final Dio dio;
 final String accountKey;
 final String? Function() currentAccountKey;
 @override bool get isCurrentAccount=>accountKey.isNotEmpty&&currentAccountKey()==accountKey;
 void ensureCurrent(){if(!isCurrentAccount)throw StateError('account_changed');}
 String path(String roomId)=>'/v1/rooms/${Uri.encodeComponent(roomId)}';
 @override Future<List<SavedRoomLesson>> list(String roomId)async{
  ensureCurrent();
  final response=await dio.get<Map<String,dynamic>>('${path(roomId)}/bookmarks',
   options:Options(headers:{'Cache-Control':'no-store'}));
  ensureCurrent();
  final items=response.data?['items'];
  if(items is! List)throw const FormatException('Invalid saved lessons response');
  return items.map((raw)=>SavedRoomLesson.fromJson(Map<String,dynamic>.from(raw as Map))).toList(growable:false);
 }
 @override Future<void> save(String roomId,String lessonId)async{
  ensureCurrent();
  await dio.put<void>('${path(roomId)}/lessons/${Uri.encodeComponent(lessonId)}/bookmark',
   options:Options(headers:{'Cache-Control':'no-store'}));
  ensureCurrent();
 }
 @override Future<void> remove(String roomId,String lessonId)async{
  ensureCurrent();
  await dio.delete<void>('${path(roomId)}/lessons/${Uri.encodeComponent(lessonId)}/bookmark',
   options:Options(headers:{'Cache-Control':'no-store'}));
  ensureCurrent();
 }
}
