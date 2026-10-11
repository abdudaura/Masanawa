import 'package:dio/dio.dart';
class RoomInfo {
 const RoomInfo(this.id,this.title,this.teacher,this.language,this.members,this.paid,this.joined);
 final String id,title,teacher,language;final int members;final bool paid,joined;
 factory RoomInfo.fromJson(Map<String,dynamic> j)=>RoomInfo(j['roomId'] as String,j['professionTitle'] as String,
  j['teacherCharacterId'] as String,j['language'] as String,(j['memberCount'] as num?)?.toInt()??0,
  j['planMode']=='paid',j['joined']==true);
}
class RoomQuestion {
 const RoomQuestion(this.id,this.body,this.status,this.answer);
 final String id,body,status;final String? answer;
 factory RoomQuestion.fromJson(Map<String,dynamic> j)=>RoomQuestion(j['questionId'] as String,
  j['body'] as String,j['state'] as String,j['answer'] as String?);
}
/// Never grant access from these prices or local purchase callbacks.
/// Only server-confirmed entitlements authorize paid Room data.
class RoomPrice {
 const RoomPrice({required this.planId,required this.version,required this.amountMinor,
  required this.currency,required this.storeProductId,required this.effectiveAt});
 final String planId,amountMinor,currency,storeProductId,effectiveAt;
 final int version;
 factory RoomPrice.fromJson(Map<String,dynamic> j)=>RoomPrice(
  planId:j['planId'] as String,version:(j['version'] as num).toInt(),
  amountMinor:j['amountMinor'] as String,currency:j['currency'] as String,
  storeProductId:j['storeProductId'] as String,effectiveAt:j['effectiveAt'] as String);
}
class RoomSubscription {
 const RoomSubscription(this.roomId,this.planId,this.priceVersion,this.state,this.periodEnd);
 final String roomId,planId,state,periodEnd;
 final int priceVersion;
 factory RoomSubscription.fromJson(Map<String,dynamic> j)=>RoomSubscription(
  j['roomId'] as String,j['planId'] as String,
  (j['priceVersion'] as num).toInt(),j['state'] as String,j['periodEnd'] as String);
 bool get permitsAccess {
  final expires=DateTime.tryParse(periodEnd)?.toUtc();
  return (state=='active'||state=='grace')&&expires!=null&&expires.isAfter(DateTime.now().toUtc());
 }
}
/// Feature-local Google Play bridge; the app integrator supplies the platform Billing callback.
abstract class RoomSubscriptionClient {
 Future<List<RoomPrice>> listPrices(String roomId);
 Future<List<RoomSubscription>> myEntitlements();
 Future<RoomSubscription> verifyPurchase(String roomId,RoomPrice price,String playPurchaseToken);
}
abstract class RoomsClient {
 Future<List<RoomInfo>> list({required bool joined,String query='',String language=''});
 Future<RoomInfo> room(String id);
 Future<void> join(String id);
 Future<void> leave(String id);
 Future<RoomQuestion> ask(String id,String text,String key);
 Future<List<RoomQuestion>> questions(String id);
 Future<List<String>> lessons(String id);
}
class HttpRoomsClient implements RoomsClient, RoomSubscriptionClient {
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
 @override Future<List<String>> lessons(String id)async{
   final r=await http.get<Map<String,dynamic>>('${path(id)}/lessons');
   return (r.data?['items'] as List<dynamic>? ?? [])
     .map((j)=>(j as Map<String,dynamic>)['body'] as String).toList();
 }
 @override Future<List<RoomPrice>> listPrices(String id)async{
  final r=await http.get<Map<String,dynamic>>('${path(id)}/plans');
  return (r.data?['prices'] as List<dynamic>? ?? [])
   .map((j)=>RoomPrice.fromJson(j as Map<String,dynamic>)).toList();
 }
 @override Future<List<RoomSubscription>> myEntitlements()async{
  final r=await http.get<Map<String,dynamic>>('/v1/subscriptions');
  return (r.data?['items'] as List<dynamic>? ?? [])
   .map((j)=>RoomSubscription.fromJson(j as Map<String,dynamic>)).toList();
 }
 @override Future<RoomSubscription> verifyPurchase(String id,RoomPrice price,String playPurchaseToken)async{
  // Token exists only for this authenticated request, never in app persistence or logs.
  final result=await http.post<Map<String,dynamic>>('${path(id)}/subscription/verify',
   data:{'planId':price.planId,'priceVersion':price.version,'purchaseToken':playPurchaseToken});
  return RoomSubscription.fromJson(result.data!);
 }

}
