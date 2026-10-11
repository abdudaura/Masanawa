import 'package:dio/dio.dart';

class FollowedMasana {
  const FollowedMasana({required this.id,required this.name,required this.profession,required this.muted});
  final String id,name,profession;
  final bool muted;
  FollowedMasana withMute(bool value)=>FollowedMasana(id:id,name:name,profession:profession,muted:value);
  factory FollowedMasana.fromJson(Map<String,dynamic> json){
    final profile=Map<String,dynamic>.from(json['profile'] as Map);
    return FollowedMasana(id:json['characterId'] as String,
      name:profile['displayName'] as String? ?? json['characterId'] as String,
      profession:profile['profession'] as String? ?? '',muted:json['muted']==true);
  }
}
class FollowingPage {
  const FollowingPage({required this.items,this.nextCursor});
  final List<FollowedMasana> items;
  final String? nextCursor;
}
abstract class FollowingRepository {
  Future<FollowingPage> list({String q='',String language='',String? cursor});
  Future<bool> setMute(String characterId,bool muted);
  Future<void> unfollow(String characterId);
}
/// Reuses the caller's authenticated Dio instance; no token storage.
class GatewayFollowingRepository implements FollowingRepository {
  GatewayFollowingRepository(this.dio);
  final Dio dio;
  @override Future<FollowingPage> list({String q='',String language='',String? cursor}) async {
    final r=await dio.get<dynamic>('/v1/me/following',
      queryParameters:{'q':q,'language':language,'limit':20,if(cursor!=null)'cursor':cursor});
    final json=Map<String,dynamic>.from(r.data as Map);
    return FollowingPage(items:(json['items'] as List<dynamic>? ?? const [])
      .map((e)=>FollowedMasana.fromJson(Map<String,dynamic>.from(e as Map))).toList(),
      nextCursor:json['nextCursor'] as String?);
  }
  @override Future<bool> setMute(String characterId,bool muted) async {
    final r=await dio.put<dynamic>('/v1/me/following/'+Uri.encodeComponent(characterId)+'/mute',
      data:{'muted':muted});
    return (r.data as Map)['muted']==true;
  }
  @override Future<void> unfollow(String characterId) async {
    // Reuses the existing Follow route and its outbox event.
    await dio.delete<dynamic>('/v1/masana/'+Uri.encodeComponent(characterId)+'/follow');
  }
}
