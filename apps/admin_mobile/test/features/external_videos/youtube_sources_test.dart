import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/features/external_videos/youtube_sources_screen.dart';

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
}
