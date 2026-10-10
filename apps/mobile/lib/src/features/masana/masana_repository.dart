import 'package:dio/dio.dart';

class MasanaProfile {
 const MasanaProfile({required this.characterId,required this.revision,required this.profile,required this.following,required this.followers});
 final String characterId;
 final int revision,followers;
 final Map<String,dynamic> profile;
 final bool following;
 String get displayName => profile['displayName'] as String? ?? characterId;
 String get profession => profile['profession'] as String? ?? '';
 String get biography => profile['biography'] as String? ?? '';
 String get story => profile['lifeStory'] as String? ?? '';
 String? get roomId => profile['roomId'] as String?;
 factory MasanaProfile.fromJson(Map<String,dynamic> json)=>MasanaProfile(
  characterId:json['characterId'] as String,revision:(json['revision'] as num).toInt(),
  profile:Map<String,dynamic>.from(json['profile'] as Map),
  following:json['following']==true,followers:(json['followerCount'] as num? ?? 0).toInt());
 MasanaProfile followState(bool follow)=>MasanaProfile(
  characterId:characterId,revision:revision,profile:profile,following:follow,
  followers:(followers+(follow&&!following?1:!follow&&following?-1:0)).clamp(0,2147483647).toInt());
}
abstract class MasanaRepository {
 Future<List<MasanaProfile>> search(String query);
 Future<MasanaProfile?> read(String characterId);
 Future<bool> setFollow(String characterId,bool following);
}
/** Reuse the existing app-owned authenticated Dio; do not create a second session authority. */
class GatewayMasanaRepository implements MasanaRepository {
 GatewayMasanaRepository(this.dio);
 final Dio dio;
 @override Future<List<MasanaProfile>> search(String query) async {
  final response=await dio.get<dynamic>('/v1/masana',queryParameters:{'q':query,'limit':50});
  final data=Map<String,dynamic>.from(response.data as Map);
  return (data['items'] as List<dynamic>? ?? const []).map((raw)=>
    MasanaProfile.fromJson(Map<String,dynamic>.from(raw as Map))).toList();
 }
 @override Future<MasanaProfile?> read(String characterId) async {
  try {
   final res=await dio.get<dynamic>('/v1/masana/${Uri.encodeComponent(characterId)}');
   return MasanaProfile.fromJson(Map<String,dynamic>.from(res.data as Map));
  } on DioException catch(e) {if(e.response?.statusCode==404)return null;rethrow;}
 }
 @override Future<bool> setFollow(String characterId,bool following) async {
  final path='/v1/masana/${Uri.encodeComponent(characterId)}/follow';
  final response=following?await dio.post<dynamic>(path):await dio.delete<dynamic>(path);
  return (response.data as Map)['following']==true;
 }
}
