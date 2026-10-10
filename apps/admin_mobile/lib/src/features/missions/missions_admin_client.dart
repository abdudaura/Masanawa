import 'package:dio/dio.dart';

class MissionView {
  const MissionView({required this.id,required this.characterId,required this.weekStart,
    required this.objective,required this.topicFocus,required this.budgetMinor,
    required this.spentMinor,required this.state,required this.revision});
  final String id,characterId,weekStart,objective,topicFocus,budgetMinor,spentMinor,state;
  final int revision;
  factory MissionView.fromJson(Map<String,dynamic> j)=>MissionView(
    id:j['missionId'] as String,characterId:j['characterId'] as String,
    weekStart:j['weekStart'] as String,objective:j['objective'] as String,
    topicFocus:j['topicFocus'] as String,budgetMinor:j['budgetMinor'] as String,
    spentMinor:j['spentMinor'] as String,state:j['state'] as String,
    revision:(j['revision'] as num).toInt());
}
class MissionSlotView {
  const MissionSlotView({required this.id,required this.kind,required this.scheduledAt,
    required this.draftBody,required this.state,required this.revision,
    required this.estimatedCostMinor,required this.postId,required this.lastError});
  final String id,kind,scheduledAt,draftBody,state,estimatedCostMinor;
  final String? postId,lastError;final int revision;
  factory MissionSlotView.fromJson(Map<String,dynamic> j)=>MissionSlotView(
    id:j['slotId'] as String,kind:j['kind'] as String,scheduledAt:j['scheduledAt'] as String,
    draftBody:j['draftBody'] as String,state:j['state'] as String,
    estimatedCostMinor:j['estimatedCostMinor'] as String,
    postId:j['postId'] as String?,lastError:j['lastError'] as String?,
    revision:(j['revision'] as num).toInt());
}
class MissionScorecard {
  const MissionScorecard({required this.published,required this.failed,required this.approved,
    required this.spentMinor,required this.budgetMinor,required this.actualEngagement});
  final int published,failed,approved;final String spentMinor,budgetMinor;
  final int? actualEngagement;
  factory MissionScorecard.fromJson(Map<String,dynamic> j)=>MissionScorecard(
    published:j['published'] as int,failed:j['failed'] as int,approved:j['approved'] as int,
    spentMinor:j['spentMinor'] as String,budgetMinor:j['budgetMinor'] as String,
    actualEngagement:j['actualEngagement'] as int?);
}
abstract class MissionsAdminClient {
  Future<List<MissionView>> missions();
  Future<MissionView> create({required String characterId,required String weekStart,
    required String objective,required String topicFocus,required String budgetMinor});
  Future<MissionView> state(MissionView mission,String state);
  Future<List<MissionSlotView>> slots(String missionId);
  Future<MissionSlotView> addSlot(String missionId,{required String atUtc,required String body,
    required String topic,required String costMinor});
  Future<MissionSlotView> approve(MissionSlotView slot);
  Future<MissionSlotView> retry(MissionSlotView slot);
  Future<MissionScorecard> scorecard(String missionId);
}
class HttpMissionsAdminClient implements MissionsAdminClient {
  const HttpMissionsAdminClient(this.dio);
  final Dio dio;
  @override Future<List<MissionView>> missions()async{
    final r=await dio.get<Map<String,dynamic>>('/v1/admin/missions');
    return (r.data?['items'] as List<dynamic>? ?? [])
      .map((x)=>MissionView.fromJson(x as Map<String,dynamic>)).toList();
  }
  @override Future<MissionView> create({required String characterId,required String weekStart,
    required String objective,required String topicFocus,required String budgetMinor})async{
    final r=await dio.post<Map<String,dynamic>>('/v1/admin/missions',data:{
      'characterId':characterId,'weekStart':weekStart,'objective':objective,
      'topicFocus':topicFocus,'budgetMinor':budgetMinor,'autonomyLevel':1});
    return MissionView.fromJson(r.data!);
  }
  @override Future<MissionView> state(MissionView m,String state)async{
    final r=await dio.patch<Map<String,dynamic>>('/v1/admin/missions/${Uri.encodeComponent(m.id)}/state',
      data:{'state':state,'revision':m.revision});
    return MissionView.fromJson(r.data!);
  }
  @override Future<List<MissionSlotView>> slots(String id)async{
    final r=await dio.get<Map<String,dynamic>>('/v1/admin/missions/${Uri.encodeComponent(id)}/slots');
    return (r.data?['items'] as List<dynamic>? ?? [])
      .map((x)=>MissionSlotView.fromJson(x as Map<String,dynamic>)).toList();
  }
  @override Future<MissionSlotView> addSlot(String id,{required String atUtc,required String body,
    required String topic,required String costMinor})async{
    final r=await dio.post<Map<String,dynamic>>('/v1/admin/missions/${Uri.encodeComponent(id)}/slots',
      data:{'kind':'text','scheduledAt':atUtc,'timeZone':'UTC','topic':topic,
        'draftBody':body,'estimatedCostMinor':costMinor});
    return MissionSlotView.fromJson(r.data!);
  }
  @override Future<MissionSlotView> approve(MissionSlotView slot)async{
    final r=await dio.post<Map<String,dynamic>>(
      '/v1/admin/missions/slots/${Uri.encodeComponent(slot.id)}/approve',data:{'revision':slot.revision});
    return MissionSlotView.fromJson(r.data!);
  }
  @override Future<MissionSlotView> retry(MissionSlotView slot)async{
    final r=await dio.post<Map<String,dynamic>>(
      '/v1/admin/missions/slots/${Uri.encodeComponent(slot.id)}/retry',data:{'revision':slot.revision});
    return MissionSlotView.fromJson(r.data!);
  }
  @override Future<MissionScorecard> scorecard(String id)async{
    final r=await dio.get<Map<String,dynamic>>('/v1/admin/missions/${Uri.encodeComponent(id)}/scorecard');
    return MissionScorecard.fromJson(r.data!);
  }
}
