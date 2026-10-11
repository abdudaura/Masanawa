import 'package:dio/dio.dart';

const _states={'connecting','active','ended','failed','expired'};
class MasanaCallHistoryEntry {
 const MasanaCallHistoryEntry({required this.id,required this.characterId,
  required this.name,required this.state,required this.createdAt,
  required this.durationSeconds});
 final String id,characterId,name,state;
 final DateTime createdAt;
 final int durationSeconds;
 factory MasanaCallHistoryEntry.fromJson(Map<String,dynamic> raw){
  final id=raw['callId'],character=raw['characterId'],state=raw['state'];
  final created=DateTime.tryParse(raw['createdAt']?.toString()??'');
  final seconds=raw['durationSeconds'];
  if(id is! String || !RegExp(r'^call_[a-fA-F0-9-]{36}$').hasMatch(id) ||
     character is! String || !RegExp(r'^character_[a-fA-F0-9-]{36}$').hasMatch(character) ||
     state is! String || !_states.contains(state) || created==null ||
     seconds is! int || seconds<0 || seconds>900){
   throw const FormatException('Invalid private call history');
  }
  final name=raw['displayName'];
  return MasanaCallHistoryEntry(id:id,characterId:character,
   name:name is String && name.trim().isNotEmpty?name:'Masanawa professional',
   state:state,createdAt:created,durationSeconds:seconds);
 }
}
class MasanaCallHistoryPage {
 const MasanaCallHistoryPage(this.items,this.nextCursor);
 final List<MasanaCallHistoryEntry> items;
 final String? nextCursor;
 factory MasanaCallHistoryPage.fromJson(Map<String,dynamic> raw){
  if(raw['schemaVersion']!=1 || raw['items'] is! List ||
     (raw['nextCursor']!=null && raw['nextCursor'] is! String)){
   throw const FormatException('Unsupported call history version');
  }
  final list=raw['items'] as List;
  return MasanaCallHistoryPage(List.unmodifiable(list.map((v){
   if(v is! Map<String,dynamic>)throw const FormatException('Invalid call history row');
   return MasanaCallHistoryEntry.fromJson(v);
  })),raw['nextCursor'] as String?);
 }
}
abstract class MasanaCallHistoryReader {
 Future<MasanaCallHistoryPage> load({String? cursor});
}
class DioMasanaCallHistoryReader implements MasanaCallHistoryReader {
 const DioMasanaCallHistoryReader(this.dio);
 final Dio dio; // Must be the same authenticated, account-scoped Dio as J04.
 @override Future<MasanaCallHistoryPage> load({String? cursor})async{
  final result=await dio.get<Map<String,dynamic>>('/v1/calls/history',
   queryParameters:{'limit':20,if(cursor!=null)'cursor':cursor});
  final data=result.data;
  if(data==null)throw const FormatException('Missing call history');
  return MasanaCallHistoryPage.fromJson(data);
 }
}
