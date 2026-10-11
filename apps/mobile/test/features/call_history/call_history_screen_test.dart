import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/call_history/call_history_api.dart';
import 'package:masanawa/src/features/call_history/call_history_screen.dart';
class _Reader implements MasanaCallHistoryReader {
 final queue=<Completer<MasanaCallHistoryPage>>[];
 @override Future<MasanaCallHistoryPage> load({String? cursor}){
  final c=Completer<MasanaCallHistoryPage>();queue.add(c);return c.future;
 }
}
void main(){
 const call='call_0199f0d0-0000-7000-8000-000000000005';
 const character='character_0199f0d0-0000-7000-8000-000000000005';
 final item=MasanaCallHistoryEntry(id:call,characterId:character,name:'Gwani',
  state:'ended',createdAt:DateTime.utc(2026,10,11),durationSeconds:15);
 testWidgets('account switch drops in-flight previous fan call history',(tester)async{
  final readerA=_Reader(),readerB=_Reader();
  await tester.pumpWidget(MaterialApp(home:MasanaCallHistoryScreen(
   accountKey:'fan-A',reader:readerA)));
  await tester.pumpWidget(MaterialApp(home:MasanaCallHistoryScreen(
   accountKey:'fan-B',reader:readerB)));
  readerA.queue.first.complete(MasanaCallHistoryPage([item],null));
  await tester.pump();
  expect(find.text('Gwani'),findsNothing);
  readerB.queue.first.complete(const MasanaCallHistoryPage([],null));
  await tester.pumpAndSettle();
  expect(find.text('Your Masana calls will appear here.'),findsOneWidget);
 });
 testWidgets('one-tap retry goes through existing call callback',(tester)async{
  final reader=_Reader();String? chosen;
  await tester.pumpWidget(MaterialApp(home:MasanaCallHistoryScreen(
   accountKey:'fan-A',reader:reader,onCall:(id)=>chosen=id)));
  reader.queue.first.complete(MasanaCallHistoryPage([item],null));
  await tester.pumpAndSettle();
  expect(find.text('Gwani'),findsOneWidget);
  await tester.tap(find.byTooltip('Call again'));
  expect(chosen,character);
 });
}
