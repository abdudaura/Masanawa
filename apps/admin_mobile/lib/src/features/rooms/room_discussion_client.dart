import 'package:dio/dio.dart';
class ModeratedRoomReply {
 const ModeratedRoomReply({required this.id,required this.roomId,required this.body,
  required this.parentKind,required this.parentId,required this.state});
 final String id,roomId,body,parentKind,parentId,state;
 factory ModeratedRoomReply.fromJson(Map<String,dynamic> j)=>ModeratedRoomReply(
  id:j['replyId'] as String,roomId:j['roomId'] as String,
  body:j['body'] as String,parentKind:j['parentKind'] as String,
  parentId:j['parentId'] as String,state:j['state'] as String);
}
abstract class RoomDiscussionModerationApi {
 Future<List<ModeratedRoomReply>> queue();
 Future<void> review(String replyId,String decision);
}
class HttpRoomDiscussionModerationApi implements RoomDiscussionModerationApi {
 const HttpRoomDiscussionModerationApi(this.dio);
 final Dio dio;
 @override Future<List<ModeratedRoomReply>> queue()async{
  final r=await dio.get<Map<String,dynamic>>('/v1/admin/rooms/discussion');
  return (r.data?['items'] as List<dynamic>? ?? []).map(
   (j)=>ModeratedRoomReply.fromJson(j as Map<String,dynamic>)).toList();
 }
 @override Future<void> review(String replyId,String decision)async{
  if(!['approve','hide','remove'].contains(decision))throw ArgumentError.value(decision);
  await dio.post<void>('/v1/admin/rooms/discussion/'+Uri.encodeComponent(replyId)+'/review',
   data:{'decision':decision});
 }
}
