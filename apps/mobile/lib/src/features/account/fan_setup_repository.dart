import 'package:dio/dio.dart';

/// C04 uses the app's existing authenticated Dio, not another token authority.
abstract interface class FanSetupRepository {
  Future<FanProfile> read();
  Future<FanProfile> save(FanSetupDraft draft);
  Future<List<FollowSuggestion>> suggestions();
  Future<void> follow(String characterId);
}
class FanProfile {
  const FanProfile({required this.revision,required this.completed,this.displayName,
    this.avatarMediaId,this.language='en',this.interests=const []});
  final int revision;
  final bool completed;
  final String? displayName,avatarMediaId;
  final String language;
  final List<String> interests;
  factory FanProfile.fromJson(Map<String,dynamic> value)=>FanProfile(
    revision:(value['revision'] as num?)?.toInt()??1,
    completed:value['completed']==true,
    displayName:value['displayName'] as String?,
    avatarMediaId:value['avatarMediaId'] as String?,
    language:value['preferredLanguage']=='ha'?'ha':'en',
    interests:(value['interests'] as List<dynamic>? ??const []).whereType<String>().toList(),
  );
}
class FanSetupDraft {
  const FanSetupDraft({required this.expectedRevision,required this.displayName,
    required this.language,required this.interests,required this.ageConfirmed,
    required this.disclosureAccepted,this.avatarMediaId});
  final int expectedRevision;
  final String displayName,language;
  final List<String> interests;
  final bool ageConfirmed,disclosureAccepted;
  final String? avatarMediaId;
  Map<String,dynamic> toJson()=>{
    'expectedRevision':expectedRevision,'displayName':displayName,
    'preferredLanguage':language,'interests':interests,
    'ageAttested18Plus':ageConfirmed,'disclosureAccepted':disclosureAccepted,
    'disclosureVersion':'masana-ai-v1','avatarMediaId':avatarMediaId
  };
}
class FollowSuggestion {
  const FollowSuggestion({required this.characterId,required this.name,required this.profession});
  final String characterId,name,profession;
  factory FollowSuggestion.fromJson(Map<String,dynamic> item){
    final profile=item['profile'] is Map
      ?Map<String,dynamic>.from(item['profile'] as Map):<String,dynamic>{};
    return FollowSuggestion(characterId:item['characterId'] as String? ?? '',
      name:profile['displayName'] as String? ?? '',
      profession:profile['profession'] as String? ?? '');
  }
}
class DioFanSetupRepository implements FanSetupRepository {
  DioFanSetupRepository(this.dio);
  final Dio dio;
  @override Future<FanProfile> read() async {
    final r=await dio.get<Map<String,dynamic>>('/v1/me');
    return FanProfile.fromJson(r.data!);
  }
  @override Future<FanProfile> save(FanSetupDraft draft) async {
    final r=await dio.patch<Map<String,dynamic>>('/v1/me',data:draft.toJson());
    return FanProfile.fromJson(r.data!);
  }
  @override Future<List<FollowSuggestion>> suggestions() async {
    final r=await dio.get<Map<String,dynamic>>('/v1/masana',
      queryParameters:const {'limit':12});
    final items=r.data?['items'];
    if(items is! List)return const [];
    return items.whereType<Map>().map((x)=>FollowSuggestion.fromJson(
      Map<String,dynamic>.from(x))).where((x)=>x.characterId.isNotEmpty).toList();
  }
  @override Future<void> follow(String characterId) async {
    if(!RegExp(r'^[A-Za-z0-9_-]{1,160}$').hasMatch(characterId)){
      throw ArgumentError.value(characterId,'characterId');
    }
    await dio.post<void>('/v1/masana/$characterId/follow');
  }
}
