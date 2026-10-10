import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/masana/masana_studio_api.dart';
import 'package:masanawa_admin/src/features/masana/masana_studio_screen.dart';

class FakeStudio implements MasanaStudioRepository {
 int approvals=0;
 int drafts=0;
 bool denied=false;
 @override Future<List<MasanaRevision>> list() async {
  if(denied) throw Exception('forbidden');
  return [MasanaRevision('masana-gwani',1,'draft',{
   'handle':'gwani','displayName':'Gwani','profession':'Technology',
   'biography':'Helpful','lifeStory':'Fictional','languages':['ha'],
   'talents':['explaining'],'goals':['teach'],'roomId':null,
   'portraitMediaId':null,'bannerMediaId':null,
  })];
 }
 @override Future<void> draft(String id,Map<String,dynamic> p) async {drafts++;}
 @override Future<void> approve(String id,int r) async {approvals++;}
 @override Future<void> attachVerifiedMedia(String id,int revision,String media,String kind,String rights) async {}
}
void main(){
 testWidgets('staff draft list requires explicit approval confirmation',(tester) async {
  final repo=FakeStudio();
  await tester.pumpWidget(MaterialApp(home:MasanaStudioScreen(repository:repo,accountKey:'staff')));
  await tester.pumpAndSettle();
  expect(find.text('Gwani'),findsOneWidget);
  expect(repo.approvals,0);
  await tester.tap(find.byTooltip('Approve revision'));
  await tester.pumpAndSettle();
  expect(find.text('Publish approved revision?'),findsOneWidget);
  await tester.tap(find.text('Cancel'));
  await tester.pumpAndSettle();
  expect(repo.approvals,0);
  await tester.tap(find.byTooltip('Approve revision'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Approve').last);
  await tester.pumpAndSettle();
  expect(repo.approvals,1);
 });
 testWidgets('staff authorization failure shows denial and retry',(tester) async {
  final repo=FakeStudio()..denied=true;
  await tester.pumpWidget(MaterialApp(home:MasanaStudioScreen(repository:repo,accountKey:'staff')));
  await tester.pumpAndSettle();
  expect(find.textContaining('Permission or network unavailable'),findsOneWidget);
  expect(find.text('Retry'),findsOneWidget);
 });
}
