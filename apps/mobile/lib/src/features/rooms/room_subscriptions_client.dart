import 'package:dio/dio.dart';

class RoomStorePrice {
  const RoomStorePrice({
    required this.planId, required this.version, required this.amountMinor,
    required this.currency, required this.storeProductId, required this.effectiveAt,
  });
  final String planId, amountMinor, currency, storeProductId, effectiveAt;
  final int version;
  factory RoomStorePrice.fromJson(Map<String, dynamic> j) => RoomStorePrice(
    planId: j['planId'] as String,
    version: (j['version'] as num).toInt(),
    amountMinor: j['amountMinor'] as String,
    currency: j['currency'] as String,
    storeProductId: j['storeProductId'] as String,
    effectiveAt: j['effectiveAt'] as String,
  );
}
class RoomPaymentOptions {
  const RoomPaymentOptions(this.prices, this.storeEnabled, this.buyerBinding);
  final List<RoomStorePrice> prices;
  final bool storeEnabled;
  final String? buyerBinding;
  factory RoomPaymentOptions.fromJson(Map<String, dynamic> j) => RoomPaymentOptions(
    ((j['prices'] as List<dynamic>?) ?? []).map((x) =>
      RoomStorePrice.fromJson(x as Map<String, dynamic>)).toList(),
    j['storeEnabled'] == true,
    j['buyerBinding'] as String?,
  );
}
class RoomSubscription {
  const RoomSubscription(this.roomId, this.state, this.periodEnd);
  final String roomId, state, periodEnd;
  factory RoomSubscription.fromJson(Map<String, dynamic> j) => RoomSubscription(
    j['roomId'] as String,j['state'] as String,j['periodEnd'] as String);
}
abstract class RoomSubscriptionsClient {
 Future<RoomPaymentOptions> options(String roomId);
 Future<RoomSubscription> verify({required String roomId,required RoomStorePrice price,
  required String purchaseToken});
 Future<List<RoomSubscription>> mine();
}
class HttpRoomSubscriptionsClient implements RoomSubscriptionsClient {
 const HttpRoomSubscriptionsClient(this.dio);
 final Dio dio;
 String _room(String id) => '/v1/rooms/${Uri.encodeComponent(id)}';
 @override Future<RoomPaymentOptions> options(String roomId) async {
  final r=await dio.get<Map<String,dynamic>>('${_room(roomId)}/plans');
  return RoomPaymentOptions.fromJson(r.data!);
 }
 @override Future<RoomSubscription> verify({required String roomId,
   required RoomStorePrice price,required String purchaseToken}) async {
  final r=await dio.post<Map<String,dynamic>>('${_room(roomId)}/subscription/verify',
   data:{'planId':price.planId,'priceVersion':price.version,'purchaseToken':purchaseToken});
  return RoomSubscription.fromJson(r.data!);
 }
 @override Future<List<RoomSubscription>> mine() async {
  final r=await dio.get<Map<String,dynamic>>('/v1/subscriptions');
  return ((r.data?['items'] as List<dynamic>?)??[]).map((e)=>
   RoomSubscription.fromJson(e as Map<String,dynamic>)).toList();
 }
}
