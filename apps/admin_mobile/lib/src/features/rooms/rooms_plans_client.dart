import 'package:dio/dio.dart';

class AdminRoomPrice {
 const AdminRoomPrice(this.planId,this.version,this.amountMinor,
  this.currency,this.storeProductId,this.effectiveAt);
 final String planId,amountMinor,currency,storeProductId,effectiveAt;
 final int version;
 factory AdminRoomPrice.fromJson(Map<String,dynamic> j)=>AdminRoomPrice(
  j['planId'] as String,(j['version'] as num).toInt(),
  j['amountMinor'] as String,j['currency'] as String,
  j['storeProductId'] as String,j['effectiveAt'] as String);
}
abstract class RoomPlansAdminClient {
 Future<List<AdminRoomPrice>> prices(String roomId);
 Future<String> createPlan(String roomId,String period);
 Future<AdminRoomPrice> addPrice(String roomId,String planId,{
  required String amountMinor,required String currency,
  required String storeProductId,required String effectiveAt});
 Future<void> activatePaid(String roomId);
}
class HttpRoomPlansAdminClient implements RoomPlansAdminClient {
 const HttpRoomPlansAdminClient(this.dio);
 final Dio dio;
 String room(String id)=>'/v1/admin/rooms/${Uri.encodeComponent(id)}';
 @override Future<List<AdminRoomPrice>> prices(String roomId)async{
  final r=await dio.get<Map<String,dynamic>>('/v1/rooms/${Uri.encodeComponent(roomId)}/plans');
  return ((r.data?['prices'] as List<dynamic>?)??[]).map((e)=>
    AdminRoomPrice.fromJson(e as Map<String,dynamic>)).toList();
 }
 @override Future<String> createPlan(String roomId,String period)async{
  final r=await dio.post<Map<String,dynamic>>('${room(roomId)}/plans',data:{'period':period});
  return r.data!['planId'] as String;
 }
 @override Future<AdminRoomPrice> addPrice(String roomId,String planId,{
  required String amountMinor,required String currency,
  required String storeProductId,required String effectiveAt})async{
  final r=await dio.post<Map<String,dynamic>>(
   '${room(roomId)}/plans/${Uri.encodeComponent(planId)}/prices',
   data:{'amountMinor':amountMinor,'currency':currency,'storeProductId':storeProductId,
    'effectiveAt':effectiveAt});
  return AdminRoomPrice.fromJson(r.data!);
 }
 @override Future<void> activatePaid(String roomId)async{
  await dio.post<void>('${room(roomId)}/activate-paid');
 }
}
