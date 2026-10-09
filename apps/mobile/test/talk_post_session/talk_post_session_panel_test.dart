import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/talk_post_session/talk_post_session.dart';
import 'package:masanawa/src/talk_post_session/talk_post_session_panel.dart';

class _Transport implements TalkInsightTransport {
  int generateCalls=0;
  @override
  Future<TalkInsightDraft?> read(String talkId) async => null;
  @override
  Future<TalkInsightDraft> generate(String talkId) async {
    generateCalls++;
    return TalkInsightDraft(
      talkId:talkId,recordingId:'recording_1',
      status:TalkInsightStatus.ready,
      updatedAt:DateTime.utc(2026,10,9),summary:'Private review only',
      highlights:const ['Audio summary'],nextTalkTitle:'Next Talk',
    );
  }
}
void main() {
  testWidgets('Host consent is mandatory before draft processing; nothing auto-posts', (tester) async {
    final transport=_Transport();
    final controller=TalkInsightController(
      transport:transport,talkId:'talk_1',ownerId:'host',activeOwnerId:()=> 'host',
    );
    await tester.pumpWidget(MaterialApp(home:Scaffold(body:TalkPostSessionPanel(controller:controller))));
    await tester.pumpAndSettle();
    expect(find.text('No eligible recording'),findsOneWidget);
    FilledButton generateButton=tester.widget(
      find.widgetWithText(FilledButton,'Generate private draft'),
    );
    expect(generateButton.onPressed,isNull);
    await tester.tap(find.text('I consent to process this retained recording for a private draft'));
    await tester.pump();
    generateButton=tester.widget(find.widgetWithText(FilledButton,'Generate private draft'));
    expect(generateButton.onPressed,isNotNull);
    await tester.tap(find.text('Generate private draft'));
    await tester.pumpAndSettle();
    expect(transport.generateCalls,1);
    expect(find.text('Private review only'),findsOneWidget);
    expect(find.text('Next Talk'),findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });
}
