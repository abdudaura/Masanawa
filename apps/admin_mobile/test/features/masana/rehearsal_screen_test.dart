import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/masana/rehearsal_api.dart';
import 'package:masanawa_admin/src/features/masana/rehearsal_screen.dart';
class FakeRepo implements MasanaRehearsalRepository {
 int calls=0;
 @override Future<MasanaRehearsal> start(String id,int rev,String mode,String prompt,String key)async{
  calls++;return const MasanaRehearsal(runId:'run_one',state:'queued');
 }
 @override Future<MasanaRehearsal> read(String id,String runId)async=>
  const MasanaRehearsal(runId:'run_one',state:'succeeded',preview:{'summary':'ok','previewText':'safe draft'});
}
void main(){
 testWidgets('A04 renders honest pending state',(tester)async{
  final repo=FakeRepo();
  await tester.pumpWidget(MaterialApp(home:MasanaRehearsalScreen(repository:repo,characterId:'gwani',revision:2,accountKey:'staff_a')));
  await tester.enterText(find.byType(TextField),'Test maths lesson');
  await tester.tap(find.text('Start rehearsal'));await tester.pumpAndSettle();
  expect(repo.calls,1);expect(find.text('safe draft'),findsNothing);
  await tester.tap(find.text('Refresh status'));await tester.pumpAndSettle();
  expect(find.text('safe draft'),findsOneWidget);
 });
}