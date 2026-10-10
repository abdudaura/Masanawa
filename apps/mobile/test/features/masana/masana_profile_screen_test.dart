import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/masana/masana_repository.dart';
import 'package:masanawa/src/features/masana/masana_profile_screen.dart';

class FakeMasanaRepository implements MasanaRepository {
 int writes=0;
 bool fail=false;
 @override Future<List<MasanaProfile>> search(String q) async => [];
 @override Future<MasanaProfile?> read(String id) async => MasanaProfile(
  characterId:id,revision:1,followers:2,following:false,
  profile:{'displayName':'Gwani','profession':'Teacher','biography':'Helpful teacher','lifeStory':'Fictional story','handle':'gwani','talents':[],'languages':['ha','en'],'goals':[]});
 @override Future<bool> setFollow(String id,bool followed) async {
  writes++;
  if(fail)throw Exception('network');
  return followed;
 }
}
void main(){
 testWidgets('C24 renders approved profile and idempotent follow state',(tester) async {
  final repo=FakeMasanaRepository();
  await tester.pumpWidget(MaterialApp(home:MasanaProfileScreen(
   characterId:'masana-gwani',accountKey:'fan_a',repository:repo)));
  await tester.pumpAndSettle();
  expect(find.text('Gwani'),findsOneWidget);
  expect(find.text('Follow'),findsOneWidget);
  await tester.tap(find.text('Follow'));
  await tester.pumpAndSettle();
  expect(find.text('Following'),findsOneWidget);
  expect(repo.writes,1);
 });
 testWidgets('failed follow keeps old state and shows retry message',(tester) async {
  final repo=FakeMasanaRepository()..fail=true;
  await tester.pumpWidget(MaterialApp(home:MasanaProfileScreen(
   characterId:'masana-gwani',accountKey:'fan_a',repository:repo)));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Follow'));await tester.pumpAndSettle();
  expect(find.textContaining('Could not save Follow'),findsOneWidget);
  expect(find.text('Follow'),findsOneWidget);
 });
}
