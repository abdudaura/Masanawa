import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/external_videos/youtube_sources_screen.dart';
import 'package:masanawa_admin/src/features/external_videos/youtube_sources_api.dart';

void main(){
  testWidgets('shows source loading and then empty state', (tester) async {
    await tester.pumpWidget(MaterialApp(home:YouTubeSourcesScreen(
      load:() async=>[],create:(_,__,___) async{},pause:(_) async{})));
    await tester.pumpAndSettle();
    expect(find.text('No YouTube sources yet'),findsOneWidget);
    expect(find.text('Register paused source'),findsOneWidget);
    expect(find.text('Enable automation'),findsNothing);
  });
  testWidgets('never sends an invalid channel to server', (tester) async {
    var calls=0;
    await tester.pumpWidget(MaterialApp(home:YouTubeSourcesScreen(
      load:() async=>[],create:(_,__,___) async{calls++;},pause:(_) async{})));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Register paused source'));
    await tester.pump();
    expect(calls,0);
    expect(find.textContaining('valid YouTube channel ID'),findsOneWidget);
  });
  testWidgets('switching Admin accounts discards an in-flight source list and draft', (tester) async {
    final oldRequest = Completer<List<YouTubeSourceRecord>>();
    final nextRequest = Completer<List<YouTubeSourceRecord>>();
    var newLoads = 0;
    final oldSource = YouTubeSourceRecord(
      id:'old-source', channelId:'UCXXXXXXXXXXXXXXXXXXXXXX', channelName:'Previous account channel',
      targetRegion:'NG', enabled:true, syncMode:'manual',
    );
    Widget screen(String account) => MaterialApp(home:YouTubeSourcesScreen(
      accountKey:account,
      load:() {
        if(account=='old')return oldRequest.future;
        newLoads++;
        return nextRequest.future;
      },
      create:(_,__,___) async {}, pause:(_) async {},
    ));
    await tester.pumpWidget(screen('old'));
    await tester.enterText(find.byType(TextField).at(1), 'Private draft');
    await tester.pumpWidget(screen('new'));
    nextRequest.complete(<YouTubeSourceRecord>[]);
    await tester.pumpAndSettle();
    expect(find.text('No YouTube sources yet'),findsOneWidget);
    expect(find.text('Private draft'),findsNothing);
    oldRequest.complete(<YouTubeSourceRecord>[oldSource]);
    await tester.pumpAndSettle();
    expect(find.text('Previous account channel'),findsNothing);
    expect(newLoads,1);
  });

  testWidgets('an old account submit cannot overwrite the new account screen', (tester) async {
    final pendingCreate = Completer<void>();
    var newLoads=0;
    Widget screen(String account)=>MaterialApp(home:YouTubeSourcesScreen(
      accountKey:account,
      load:() async {
        if(account=='new')newLoads++;
        return <YouTubeSourceRecord>[];
      },
      create:(_,__,___)=>account=='old'?pendingCreate.future:Future<void>.value(),
      pause:(_) async {},
    ));
    await tester.pumpWidget(screen('old'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0),'UCXXXXXXXXXXXXXXXXXXXXXX');
    await tester.enterText(find.byType(TextField).at(1),'Private draft');
    await tester.tap(find.text('Register paused source'));
    await tester.pump();
    await tester.pumpWidget(screen('new'));
    await tester.pumpAndSettle();
    expect(find.text('Private draft'),findsNothing);
    pendingCreate.complete();
    await tester.pumpAndSettle();
    expect(newLoads,1);
    expect(find.text('No YouTube sources yet'),findsOneWidget);
    expect(find.text('Submission failed'),findsNothing);
  });

  testWidgets('disabled source administration makes no requests', (tester) async {
    var loads=0, creates=0;
    await tester.pumpWidget(MaterialApp(home:YouTubeSourcesScreen(
      enabled:false,load:() async {loads++;return [];},
      create:(_,__,___) async {creates++;},pause:(_) async {},
    )));
    expect(find.text('Video source administration is unavailable'),findsOneWidget);
    expect(find.text('Register paused source'),findsNothing);
    expect(loads,0);
    expect(creates,0);
  });

}
