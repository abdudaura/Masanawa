import 'package:dio/dio.dart';
class MasanaRevision {
 const MasanaRevision(this.characterId,this.revision,this.state,this.profile);
 final String characterId,state;
 final int revision;
 final Map<String,dynamic> profile;
 factory MasanaRevision.fromJson(Map<String,dynamic> json)=>MasanaRevision(
  json['characterId'] as String,(json['revision'] as num).toInt(),
  json['state'] as String,Map<String,dynamic>.from(json['profile'] as Map));
}
abstract class MasanaStudioRepository {
 Future<List<MasanaRevision>> list();
 Future<void> draft(String characterId,int expectedRevision,Map<String,dynamic> profile);
 Future<void> approve(String characterId,int revision);
 Future<void> attachVerifiedMedia(String characterId,int revision,String mediaId,String kind,String rightsNote);
}
/// Reuses the existing Admin authenticated Dio. No new token store.
class GatewayMasanaStudioRepository implements MasanaStudioRepository {
 GatewayMasanaStudioRepository(this.dio); final Dio dio;
 @override Future<List<MasanaRevision>> list() async {
  final response=await dio.get<dynamic>('/v1/admin/masana');
  final items=(response.data as Map)['items'] as List<dynamic>? ?? const [];
  return items.map((raw)=>MasanaRevision.fromJson(Map<String,dynamic>.from(raw as Map))).toList();
 }
 @override Future<void> draft(String characterId,int expectedRevision,Map<String,dynamic> profile) async {
  await dio.post<dynamic>('/v1/admin/masana/${Uri.encodeComponent(characterId)}/revisions',
   data:{'expectedRevision':expectedRevision,'profile':profile});
 }
 @override Future<void> attachVerifiedMedia(String characterId,int revision,String mediaId,String kind,String rightsNote) async {
  await dio.post<dynamic>('/v1/admin/masana/${Uri.encodeComponent(characterId)}/revisions/$revision/media',
   data:{'mediaId':mediaId,'kind':kind,'rightsNote':rightsNote});
 }
 @override Future<void> approve(String characterId,int revision) async {
  await dio.post<dynamic>('/v1/admin/masana/${Uri.encodeComponent(characterId)}/revisions/$revision/approve');
 }
}
