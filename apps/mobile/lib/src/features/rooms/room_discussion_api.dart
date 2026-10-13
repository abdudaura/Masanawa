import 'package:dio/dio.dart';

class RoomDiscussionTarget {
 const RoomDiscussionTarget({required this.kind,required this.id,required this.label});
 final String kind,id,label;
}
class RoomDiscussionReply {
 const RoomDiscussionReply({required this.id,required this.body,required this.state,
  required this.createdAt,required this.byMe,required this.parentReplyId});
 final String id,body,state,createdAt; final bool byMe; final String? parentReplyId;
 factory RoomDiscussionReply.fromJson(Map<String,dynamic> j)=>RoomDiscussionReply(
  id:j['replyId'] as String,body:j['body'] as String,state:j['state'] as String,
  createdAt:j['createdAt'] as String,byMe:j['authoredByMe']==true,
  parentReplyId:j['parentReplyId'] as String?);
}
class RoomDiscussionPage {
 const RoomDiscussionPage(this.items,this.cursor);
 final List<RoomDiscussionReply> items;final String? cursor;
}
abstract class RoomDiscussionApi {
 Future<List<RoomDiscussionTarget>> targets(String roomId);
 Future<RoomDiscussionPage> list(String roomId,RoomDiscussionTarget target,{String? cursor});
 Future<RoomDiscussionReply> send(String roomId,RoomDiscussionTarget target,String body,String key,{String? parentReplyId});
}
class HttpRoomDiscussionApi implements RoomDiscussionApi {
 const HttpRoomDiscussionApi(this.dio);
 final Dio dio;
 String path(String id)=>'/v1/rooms/'+Uri.encodeComponent(id);
 @override Future<List<RoomDiscussionTarget>> targets(String roomId)async{
  final p=path(roomId);
  final a=await dio.get<Map<String,dynamic>>(p+'/lessons');
  final b=await dio.get<Map<String,dynamic>>(p+'/questions');
  final lessons=(a.data?['items'] as List<dynamic>? ?? []).map((v){
   final j=v as Map<String,dynamic>;
   return RoomDiscussionTarget(kind:'lesson',id:j['lessonId'] as String,
    label:(j['body'] as String? ?? 'Lesson').trim());
  });
  final questions=(b.data?['items'] as List<dynamic>? ?? []).map((v){
   final j=v as Map<String,dynamic>;
   return RoomDiscussionTarget(kind:'question',id:j['questionId'] as String,
    label:(j['body'] as String? ?? 'Question').trim());
  });
  return [...lessons,...questions].toList();
 }
 @override Future<RoomDiscussionPage> list(String roomId,RoomDiscussionTarget target,{String? cursor})async{
  final r=await dio.get<Map<String,dynamic>>(path(roomId)+'/discussion',
   queryParameters:{'kind':target.kind,'parentId':target.id,if(cursor!=null)'cursor':cursor});
  final j=r.data??{};
  return RoomDiscussionPage((j['items'] as List<dynamic>? ?? []).map(
   (v)=>RoomDiscussionReply.fromJson(v as Map<String,dynamic>)).toList(),j['nextCursor'] as String?);
 }
 @override Future<RoomDiscussionReply> send(String roomId,RoomDiscussionTarget target,String body,String key,{String? parentReplyId})async{
  final r=await dio.post<Map<String,dynamic>>(path(roomId)+'/discussion',
   options:Options(headers:{'Idempotency-Key':key}),data:{
    'parentKind':target.kind,'parentId':target.id,'body':body,
    if(parentReplyId!=null)'parentReplyId':parentReplyId});
  return RoomDiscussionReply.fromJson(r.data!);
 }
}
