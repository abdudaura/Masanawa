import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/account/fan_setup_repository.dart';
import 'package:masanawa/src/features/account/fan_setup_screen.dart';

class FakeRepo implements FanSetupRepository {
 FakeRepo(this.profile);
 FanProfile profile;
 int writes=0,follows=0;
 @override Future<FanProfile> read() async=>profile;
 @override Future<FanProfile> save(FanSetupDraft draft) async{
  writes++;
  if(!draft.ageConfirmed||!draft.disclosureAccepted)throw StateError('missing consent');
  profile=FanProfile(revision:profile.revision+1,completed:true,
   displayName:draft.displayName,language:draft.language,interests:draft.interests);
  return profile;
 }
 @override Future<List<FollowSuggestion>> suggestions() async=>const [
  FollowSuggestion(characterId:'masana-gwani',name:'Gwani',profession:'Technology')];
 @override Future<void> follow(String id) async{follows++;}
}
void main(){
 testWidgets('C04 requires age and one-time AI acknowledgement before saving',(tester) async{
  final repo=FakeRepo(const FanProfile(revision:1,completed:false));
  await tester.pumpWidget(MaterialApp(home:FanSetupScreen(
   accountKey:'fan-a',repository:repo,onComplete:(){})));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('fan-name')),'Amina');
  await tester.ensureVisible(find.byKey(const Key('fan-save')));
  await tester.tap(find.byKey(const Key('fan-save')));
  await tester.pump();
  expect(repo.writes,0);
  await tester.ensureVisible(find.byKey(const Key('fan-age')));
  await tester.tap(find.byKey(const Key('fan-age')));
  await tester.ensureVisible(find.byKey(const Key('fan-ai')));
  await tester.tap(find.byKey(const Key('fan-ai')));
  await tester.ensureVisible(find.byKey(const Key('fan-save')));
  await tester.tap(find.byKey(const Key('fan-save')));
  await tester.pumpAndSettle();
  expect(repo.writes,1);
  expect(find.byKey(const Key('fan-finish')),findsOneWidget);
  await tester.ensureVisible(find.byKey(const Key('fan-follow-masana-gwani')));
  await tester.tap(find.byKey(const Key('fan-follow-masana-gwani')));
  await tester.pumpAndSettle();
  expect(repo.follows,1);
 });
 testWidgets('C04 account switch clears previous account name and follow state',(tester) async{
  final a=FakeRepo(const FanProfile(revision:2,completed:true,displayName:'Old fan'));
  final b=FakeRepo(const FanProfile(revision:1,completed:false));
  Widget screen(String key,FakeRepo repo)=>MaterialApp(home:FanSetupScreen(
   accountKey:key,repository:repo,onComplete:(){}));
  await tester.pumpWidget(screen('fan-a',a));
  await tester.pumpAndSettle();
  expect(find.byKey(const Key('fan-finish')),findsOneWidget);
  await tester.pumpWidget(screen('fan-b',b));
  await tester.pumpAndSettle();
  expect(find.text('Old fan'),findsNothing);
  expect(find.byKey(const Key('fan-name')),findsOneWidget);
  expect(find.byKey(const Key('fan-finish')),findsNothing);
 });
}
