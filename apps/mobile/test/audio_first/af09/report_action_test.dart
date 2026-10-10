import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/audio_posts/audio_post_report_action.dart';

class FakeReports implements PublishedAudioReportTransport {
  final requests = <({String postId, String reason, String key, String? detail})>[];
  bool fail = false;
  @override
  Future<String> submit({
    required String postId,
    required String reason,
    required String clientRequestId,
    String? detail,
  }) async {
    requests.add((postId: postId, reason: reason, key: clientRequestId,
      detail: detail));
    if (fail) throw Exception('network uncertain');
    return 'accepted-1';
  }
}

void main() {
  Future<void> mount(WidgetTester tester, FakeReports reports, {
    bool enabled = true,
  }) async {
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(body: AudioPostReportAction(
        postId: 'post-1', transport: reports, enabled: enabled,
      )),
    ));
  }

  testWidgets('explicit confirmation produces canonical report receipt UI',
      (tester) async {
    final reports = FakeReports();
    await mount(tester, reports);
    await tester.tap(find.text('Report Talk'));
    await tester.pumpAndSettle();
    expect(reports.requests, isEmpty);
    await tester.tap(find.text('Submit report'));
    await tester.pumpAndSettle();
    expect(reports.requests, hasLength(1));
    expect(reports.requests.single.postId, 'post-1');
    expect(reports.requests.single.reason, 'spam');
    expect(reports.requests.single.key, startsWith('audio-report-'));
    expect(find.text('Report received for review.'), findsOneWidget);
  });

  testWidgets('uncertain report retries reuse one request key', (tester) async {
    final reports = FakeReports()..fail = true;
    await mount(tester, reports);
    await tester.tap(find.text('Report Talk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit report'));
    await tester.pumpAndSettle();
    expect(find.textContaining('not confirmed'), findsOneWidget);
    final original = reports.requests.single.key;
    reports.fail = false;
    await tester.tap(find.text('Submit report'));
    await tester.pumpAndSettle();
    expect(reports.requests, hasLength(2));
    expect(reports.requests[1].key, original);
    expect(find.text('Report received for review.'), findsOneWidget);
  });

  testWidgets('cancel and disabled action never submit a report',
      (tester) async {
    final reports = FakeReports();
    await mount(tester, reports);
    await tester.tap(find.text('Report Talk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(reports.requests, isEmpty);
    await mount(tester, reports, enabled: false);
    await tester.pumpAndSettle();
    final button = tester.widget<TextButton>(find.byType(TextButton).first);
    expect(button.onPressed, isNull);
    expect(reports.requests, isEmpty);
  });
}
