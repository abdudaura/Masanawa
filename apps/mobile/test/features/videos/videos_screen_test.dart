import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/videos/video_models.dart';
import 'package:masanawa/src/features/videos/videos_screen.dart';
void main() {
  test('rejects spoofed source and unapproved metadata',(){
    const data = {'id':'1','title':'Maths','channelName':'Tutor','provider':'youtube','reviewState':'approved','verifiedAt':'2026-10-10T12:00:00Z'};
    expect(()=>ExternalVideo.fromJson({...data,'sourceUrl':'https://www.youtube.com.evil.test/watch?v=abcDE12_-34'}),throwsFormatException);
    expect(()=>ExternalVideo.fromJson({...data,'reviewState':'pending','sourceUrl':'https://www.youtube.com/watch?v=abcDE12_-34'}),throwsFormatException);
  });
  testWidgets('displays empty, offline and approved provider attribution', (tester) async {
    Future<List<ExternalVideo>> empty({String? provider}) async => [];
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:ExternalVideosScreen(load:empty))));
    await tester.pumpAndSettle();
    expect(find.text('No approved videos'),findsOneWidget);
    Future<List<ExternalVideo>> offline({String? provider}) async => throw StateError('offline');
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:ExternalVideosScreen(load:offline))));
    await tester.pumpAndSettle();
    expect(find.text('Videos offline or unavailable'),findsOneWidget);
    final v=ExternalVideo(id:'1',title:'Maths',channelName:'Tutor',provider:'youtube',sourceUrl:Uri.parse('https://www.youtube.com/watch?v=abcDE12_-34'));
    Future<List<ExternalVideo>> loaded({String? provider}) async => [v];
    Uri? opened;
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:ExternalVideosScreen(load:loaded,open:(uri) async {opened=uri;return true;}))));
    await tester.pumpAndSettle();
    expect(find.text('Tutor · youtube'),findsOneWidget);
    await tester.tap(find.text('Maths'));
    await tester.pump();
    expect(opened,v.sourceUrl);
  });
}
