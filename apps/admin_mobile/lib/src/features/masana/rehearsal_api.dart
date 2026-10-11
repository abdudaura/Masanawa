import 'package:dio/dio.dart';
class MasanaRehearsal {
 const MasanaRehearsal({required this.runId,required this.state,this.preview,this.errorCode});
 final String runId,state;
 final Map<String,dynamic>? preview;
 final String? errorCode;
 factory MasanaRehearsal.fromJson(Map<String,dynamic> x)=>MasanaRehearsal(
  runId:x['runId']?.toString()??'',state:x['state']?.toString()??'unknown',
  preview:x['preview'] is Map?Map<String,dynamic>.from(x['preview'] as Map):null,errorCode:x['errorCode']?.toString());
}
abstract class MasanaRehearsalRepository {
 Future<MasanaRehearsal> start(String id,int revision,String mode,String prompt,String key);
 Future<MasanaRehearsal> read(String id,String runId);
}
class GatewayMasanaRehearsalRepository implements MasanaRehearsalRepository {
 GatewayMasanaRehearsalRepository(this.dio);final Dio dio;
 @override Future<MasanaRehearsal> start(String id,int revision,String mode,String prompt,String key)async{
  final x=await dio.post<dynamic>('/v1/admin/masana/'+Uri.encodeComponent(id)+'/rehearsals',
    data:{'revision':revision,'mode':mode,'prompt':prompt,'idempotencyKey':key});
  return MasanaRehearsal.fromJson(Map<String,dynamic>.from(x.data as Map));
 }
 @override Future<MasanaRehearsal> read(String id,String runId)async{
  final x=await dio.get<dynamic>('/v1/admin/masana/'+Uri.encodeComponent(id)+'/rehearsals/'+Uri.encodeComponent(runId));
  return MasanaRehearsal.fromJson(Map<String,dynamic>.from(x.data as Map));
 }
}