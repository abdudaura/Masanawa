import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/masana/following_repository.dart';
import 'package:masanawa/src/features/masana/following_screen.dart';

class FakeFollowing implements FollowingRepository {
 bool muted=false,fail=false,denied=false;
 @override Future<FollowingPage> list({String q='',String language='',String? cursor}) async {
  if(denied)throw DioException(requestOptions:RequestOptions(path:'/v1/me/following'),
   response:Response<dynamic>(requestOptions:RequestOptions(path:'/v1/me/following'),statusCode:403));
  if(fail)throw StateError('offline');
  return FollowingPage(items:[FollowedMasana(id:'masana_1',name:'Zara',
    profession:'Teacher',muted:muted)],nextCursor:null);
 }
 @override Future<bool> setMute(String id,bool next) async {muted=next;return next;}
 @override Future<void> unfollow(String id) async {}
}
void main(){
 testWidgets('private Following list and mute',(tester)async{
  final repo=FakeFollowing();
  await tester.pumpWidget(MaterialApp(home:MasanaFollowingScreen(
   repository:repo,accountKey:'fan1',openProfile:(_){},)));
  await tester.pumpAndSettle();
  expect(find.text('Zara'),findsOneWidget);
  await tester.tap(find.byTooltip('Following options'));await tester.pumpAndSettle();
  await tester.tap(find.text('Mute').last);await tester.pumpAndSettle();
  expect(repo.muted,isTrue);
 });
 testWidgets('authorization denial removes private cached follows',(tester)async{
  final repo=FakeFollowing();
  await tester.pumpWidget(MaterialApp(home:MasanaFollowingScreen(
   repository:repo,accountKey:'fan1',openProfile:(_){},)));
  await tester.pumpAndSettle();expect(find.text('Zara'),findsOneWidget);
  repo.denied=true;
  await tester.tap(find.byTooltip('Search'));await tester.pumpAndSettle();
  expect(find.text('Zara'),findsNothing);
  expect(find.textContaining('Please sign in again'),findsOneWidget);
 });
 testWidgets('account switch clears another fans cached list',(tester)async{
  final repo=FakeFollowing();
  await tester.pumpWidget(MaterialApp(home:MasanaFollowingScreen(
   repository:repo,accountKey:'fan1',openProfile:(_){},)));
  await tester.pumpAndSettle();expect(find.text('Zara'),findsOneWidget);
  repo.fail=true;
  await tester.pumpWidget(MaterialApp(home:MasanaFollowingScreen(
   repository:repo,accountKey:'fan2',openProfile:(_){},)));
  await tester.pumpAndSettle();
  expect(find.text('Zara'),findsNothing);
  expect(find.textContaining('Could not load'),findsOneWidget);
 });
}
