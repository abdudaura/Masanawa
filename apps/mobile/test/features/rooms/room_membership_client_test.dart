import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/room_membership_client.dart';

void main(){
 test('account mismatch denies before HTTP dispatch',() async {
  var calls=0;final dio=Dio();
  dio.interceptors.add(InterceptorsWrapper(onRequest:(r,h){calls++;h.resolve(Response(requestOptions:r,data:{'items':[]}));}));
  final client=HttpRoomMembershipClient(dio,accountId:'a',currentAccountId:()=>'b');
  await expectLater(client.members('room_example'),throwsA(isA<RoomMembershipFailure>().having((e)=>e.code,'code','account_changed')));
  expect(calls,0);
 });
 test('response from old account rejected after account switch',() async {
  var account='a';final pending=Completer<RequestInterceptorHandler>();final dio=Dio();
  RequestOptions? request;
  dio.interceptors.add(InterceptorsWrapper(onRequest:(r,h){request=r;pending.complete(h);}));
  final client=HttpRoomMembershipClient(dio,accountId:'a',currentAccountId:()=>account);
  final future=client.members('room_example');final handler=await pending.future;
  account='b';handler.resolve(Response(requestOptions:request!,data:{'items':[]}));
  await expectLater(future,throwsA(isA<RoomMembershipFailure>().having((e)=>e.code,'code','account_changed')));
 });
 test('invite token is sent in POST body and false receipt denied',() async {
  final dio=Dio();RequestOptions? request;
  dio.interceptors.add(InterceptorsWrapper(onRequest:(r,h){request=r;h.resolve(Response(requestOptions:r,data:{'joined':false}));}));
  final client=HttpRoomMembershipClient(dio,accountId:'a',currentAccountId:()=>'a');
  await expectLater(client.accept('room_example',' test-code '),throwsA(isA<RoomMembershipFailure>()));
  expect(request!.method,'POST');expect(request!.path,'/v1/rooms/room_example/invites/accept');
  expect(request!.data,{'token':'test-code'});expect(request!.queryParameters,isEmpty);
 });
 test('server bans retain typed denial without raw error details',() async {
  final dio=Dio();
  dio.interceptors.add(InterceptorsWrapper(onRequest:(r,h){h.reject(DioException(requestOptions:r,
   response:Response(requestOptions:r,statusCode:403,data:{'code':'room_banned','details':'private'})));}));
  final client=HttpRoomMembershipClient(dio,accountId:'a',currentAccountId:()=>'a');
  await expectLater(client.accept('room_example','code'),throwsA(isA<RoomMembershipFailure>().having((e)=>e.code,'code','room_banned')));
 });
 test('malformed roster and invite projections fail closed',(){
  expect(()=>RoomMember.parse({'userId':'a','state':'active','role':'owner'}),throwsA(isA<RoomMembershipFailure>()));
  expect(()=>RoomInvite.parse({'inviteId':'i','expiresAt':'invalid','revoked':false,'accepted':false}),throwsA(isA<RoomMembershipFailure>()));
 });
}
