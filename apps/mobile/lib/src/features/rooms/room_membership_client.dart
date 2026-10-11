import 'package:dio/dio.dart';

class RoomMembershipFailure implements Exception {
 const RoomMembershipFailure(this.code);
 final String code;
}
class RoomMember {
 const RoomMember(this.userId, this.state, this.role);
 final String userId, state, role;
 factory RoomMember.parse(Map<String, dynamic> json) {
  final id=json['userId'], state=json['state'], role=json['role'];
  if(id is! String || !['active','left','banned'].contains(state) ||
     !['member','moderator'].contains(role)) {
   throw const RoomMembershipFailure('invalid_response');
  }
  return RoomMember(id,state as String,role as String);
 }
}
class RoomInvite {
 const RoomInvite(this.id,this.expiresAt,this.revoked,this.accepted,{this.token});
 final String id;
 final DateTime expiresAt;
 final bool revoked,accepted;
 final String? token;
 factory RoomInvite.parse(Map<String,dynamic> json) {
  final id=json['inviteId'], expires=json['expiresAt'], token=json['token'];
  if(id is! String || expires is! String || DateTime.tryParse(expires)==null ||
     json['revoked'] is! bool || json['accepted'] is! bool ||
     (token!=null && (token is! String || !RegExp(r'^[A-Za-z0-9_-]{43}$').hasMatch(token)))) {
   throw const RoomMembershipFailure('invalid_response');
  }
  return RoomInvite(id,DateTime.parse(expires),json['revoked'] as bool,
   json['accepted'] as bool,token:token as String?);
 }
}
abstract class RoomMembershipClient {
 Future<List<RoomMember>> members(String roomId);
 Future<List<RoomInvite>> invites(String roomId);
 Future<RoomInvite> issue(String roomId);
 Future<void> revoke(String roomId,String inviteId);
 Future<void> moderate(String roomId,String userId,String action);
 Future<void> accept(String roomId,String token);
}

/// Use the canonical authenticated Dio. Construct a new client per account.
/// No invitation tokens or roster projections are persisted on the device.
class HttpRoomMembershipClient implements RoomMembershipClient {
 const HttpRoomMembershipClient(this.http,{required this.accountId,required this.currentAccountId});
 final Dio http;
 final String accountId;
 final String? Function() currentAccountId;
 String path(String roomId)=>'/v1/rooms/${Uri.encodeComponent(roomId)}';
 void _account(){
  if(accountId.isEmpty || currentAccountId()!=accountId) {
   throw const RoomMembershipFailure('account_changed');
  }
 }
 Future<Map<String,dynamic>> _request(String path,{Map<String,dynamic>? body}) async {
  _account();
  try {
   final response=body==null
    ? await http.get<Map<String,dynamic>>(path)
    : await http.post<Map<String,dynamic>>(path,data:body);
   _account();
   if(response.data==null)throw const RoomMembershipFailure('invalid_response');
   return response.data!;
  } on DioException catch(e) {
   _account();
   final data=e.response?.data;
   final code=data is Map ? data['code'] : null;
   throw RoomMembershipFailure(code is String ? code : 'rooms_unavailable');
  }
 }
 List<Map<String,dynamic>> _items(Map<String,dynamic> json) {
  final items=json['items'];
  if(items is! List || items.any((e)=>e is! Map<String,dynamic>)) {
   throw const RoomMembershipFailure('invalid_response');
  }
  return items.cast<Map<String,dynamic>>();
 }
 @override Future<List<RoomMember>> members(String id) async =>
  _items(await _request('${path(id)}/members')).map(RoomMember.parse).toList();
 @override Future<List<RoomInvite>> invites(String id) async =>
  _items(await _request('${path(id)}/invites')).map(RoomInvite.parse).toList();
 @override Future<RoomInvite> issue(String id) async =>
  RoomInvite.parse(await _request('${path(id)}/invites',body:{}));
 @override Future<void> revoke(String id,String invite) async {
  final result=await _request('${path(id)}/invites/${Uri.encodeComponent(invite)}/revoke',body:{});
  if(result['revoked']!=true)throw const RoomMembershipFailure('invalid_response');
 }
 @override Future<void> moderate(String id,String target,String action) async {
  final result=await _request('${path(id)}/members/${Uri.encodeComponent(target)}/moderate',body:{'action':action});
  if(result['updated']!=true)throw const RoomMembershipFailure('invalid_response');
 }
 @override Future<void> accept(String id,String token) async {
  final result=await _request('${path(id)}/invites/accept',body:{'token':token.trim()});
  if(result['joined']!=true)throw const RoomMembershipFailure('invalid_response');
 }
}
