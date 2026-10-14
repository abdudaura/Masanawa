import 'package:dio/dio.dart';
class RoomInfo {
 const RoomInfo(this.id,this.title,this.teacher,this.language,this.members,this.paid,this.joined,
  {this.teacherDisplayName,this.priceKobo,this.trialMinutes});
 final String id,title,teacher,language;final int members;final bool paid,joined;
 /// Optional server-authoritative labels/terms; never invent a price or trial.
 final String? teacherDisplayName;
 final int? priceKobo,trialMinutes;
 factory RoomInfo.fromJson(Map<String,dynamic> j)=>RoomInfo(j['roomId'] as String,j['professionTitle'] as String,
  j['teacherCharacterId'] as String,j['language'] as String,(j['memberCount'] as num?)?.toInt()??0,
  j['planMode']=='paid',j['joined']==true,
  teacherDisplayName: j['teacherDisplayName'] is String ? j['teacherDisplayName'] as String : null,
  priceKobo: j['priceKobo'] is int && (j['priceKobo'] as int)>=0 ? j['priceKobo'] as int : null,
  trialMinutes: j['trialMinutes'] is int && (j['trialMinutes'] as int)>0 ? j['trialMinutes'] as int : null);
}
class RoomQuestion {
 const RoomQuestion(this.id,this.body,this.status,this.answer,{this.authorUserId});
 final String id,body,status;final String? answer;
 final String? authorUserId;
 factory RoomQuestion.fromJson(Map<String,dynamic> j)=>RoomQuestion(j['questionId'] as String,
  j['body'] as String,j['state'] as String,j['answer'] as String?,
  authorUserId:j['authorUserId'] is String ? j['authorUserId'] as String : null);
}
class RoomLesson {
 const RoomLesson(this.id,this.body,this.kind);
 final String id,body,kind;
 factory RoomLesson.fromJson(Map<String,dynamic> value) {
  final id=value['lessonId'],body=value['body'],kind=value['kind'];
  if(id is! String || !id.startsWith('room-lesson_') ||
     body is! String || (kind!='lesson' && kind!='announcement')) {
   throw const FormatException('Invalid Room lesson');
  }
  return RoomLesson(id,body,kind as String);
 }
}
abstract class RoomsClient {
 Future<List<RoomInfo>> list({required bool joined,String query='',String language=''});
 Future<RoomInfo> room(String id);
 Future<void> join(String id);
 Future<void> leave(String id);
 Future<RoomQuestion> ask(String id,String text,String key);
 Future<List<RoomQuestion>> questions(String id);
 Future<List<RoomLesson>> lessons(String id);
}
class HttpRoomsClient implements RoomsClient {
 const HttpRoomsClient(this.http);
 final Dio http;
 String path(String id)=>'/v1/rooms/${Uri.encodeComponent(id)}';
 @override Future<List<RoomInfo>> list({required bool joined,String query='',String language=''})async{
   final r=await http.get<Map<String,dynamic>>('/v1/rooms',
     queryParameters:{'tab':joined?'joined':'discover','q':query,'lang':language});
   return (r.data?['items'] as List<dynamic>? ?? []).map((j)=>RoomInfo.fromJson(j as Map<String,dynamic>)).toList();
 }
 @override Future<RoomInfo> room(String id)async=>
   RoomInfo.fromJson((await http.get<Map<String,dynamic>>(path(id))).data!);
 @override Future<void> join(String id)async{await http.post<void>('${path(id)}/join');}
 @override Future<void> leave(String id)async{await http.post<void>('${path(id)}/leave');}
 @override Future<RoomQuestion> ask(String id,String text,String key)async{
   final r=await http.post<Map<String,dynamic>>('${path(id)}/questions',
     data:{'body':text},options:Options(headers:{'Idempotency-Key':key}));
   return RoomQuestion.fromJson(r.data!);
 }
 @override Future<List<RoomQuestion>> questions(String id)async{
   final r=await http.get<Map<String,dynamic>>('${path(id)}/questions');
   return (r.data?['items'] as List<dynamic>? ?? []).map((j)=>RoomQuestion.fromJson(j as Map<String,dynamic>)).toList();
 }
 @override Future<List<RoomLesson>> lessons(String id)async{
   final r=await http.get<Map<String,dynamic>>('${path(id)}/lessons');
   return (r.data?['items'] as List<dynamic>? ?? [])
     .map((j)=>RoomLesson.fromJson(Map<String,dynamic>.from(j as Map))).toList();
 }

}
