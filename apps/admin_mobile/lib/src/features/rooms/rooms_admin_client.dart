import 'package:dio/dio.dart';
class ReviewQuestion {
 ReviewQuestion(this.id,this.roomId,this.body,this.state,this.draft);
 final String id,roomId,body,state;final String? draft;
 factory ReviewQuestion.fromJson(Map<String,dynamic> j)=>ReviewQuestion(
  j['questionId'] as String,j['roomId'] as String,j['body'] as String,
  j['state'] as String,j['answer'] as String?);
}
abstract class RoomsAdminClient {
 Future<List<ReviewQuestion>> queue();
 Future<List<Map<String,dynamic>>> rooms();
 Future<void> review(String questionId,String answer,{required bool approve});
 Future<void> create({required String slug,required String title,required String teacherId});
 Future<void> publish(String roomId);
}
class HttpRoomsAdminClient implements RoomsAdminClient {
 const HttpRoomsAdminClient(this.dio);
 final Dio dio;
 @override Future<List<ReviewQuestion>> queue()async{
  final r=await dio.get<Map<String,dynamic>>('/v1/admin/rooms/questions');
  return (r.data?['items'] as List<dynamic>? ?? []).map((j)=>ReviewQuestion.fromJson(j as Map<String,dynamic>)).toList();
 }
 @override Future<List<Map<String,dynamic>>> rooms()async{
  final r=await dio.get<Map<String,dynamic>>('/v1/admin/rooms');
  return (r.data?['items'] as List<dynamic>? ?? []).cast<Map<String,dynamic>>();
 }
 @override Future<void> review(String id,String body,{required bool approve})async{
  await dio.post<void>('/v1/admin/rooms/questions/${Uri.encodeComponent(id)}/review',
   data:{'decision':approve?'approve':'reject','answer':body});
 }
 @override Future<void> create({required String slug,required String title,required String teacherId})async{
  await dio.post<void>('/v1/admin/rooms',data:{'slug':slug,'professionTitle':title,
    'teacherCharacterId':teacherId,'language':'en'});
 }
 @override Future<void> publish(String roomId)async{
  await dio.post<void>('/v1/admin/rooms/${Uri.encodeComponent(roomId)}/publish');
 }
}
