import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/videos/video_models.dart';
import 'package:masanawa/src/features/videos/videos_screen.dart';

void main() {
  const data = {
    'id': '1', 'title': 'Maths', 'channelName': 'Tutor',
    'provider': 'youtube', 'providerVideoId': 'abcDE12_-34',
    'reviewState': 'approved', 'verifiedAt': '2026-10-10T12:00:00Z',
    'sourceUrl': 'https://www.youtube.com/watch?v=abcDE12_-34',
  };
  test('only verified official metadata reaches a video screen', () {
    expect(() => ExternalVideo.fromJson({...data,
      'sourceUrl': 'https://www.youtube.com.evil.test/watch?v=abcDE12_-34'}),
      throwsFormatException);
    expect(() => ExternalVideo.fromJson({...data,
      'reviewState': 'pending'}), throwsFormatException);
    expect(() => ExternalVideo.fromJson({...data,
      'providerVideoId': 'xxxxxxxxxxx'}), throwsFormatException);
    final parsed = ExternalVideo.fromJson(data);
    expect(parsed.title, 'Maths');
  });
  testWidgets('empty, offline and approved attributed video opens player',
      (tester) async {
    Future<List<ExternalVideo>> empty({String? provider}) async => [];
    await tester.pumpWidget(MaterialApp(home: Scaffold(body:
      ExternalVideosScreen(load: empty))));
    await tester.pumpAndSettle();
    expect(find.text('No approved videos'), findsOneWidget);

    Future<List<ExternalVideo>> offline({String? provider}) async =>
      throw StateError('offline');
    await tester.pumpWidget(MaterialApp(home: Scaffold(body:
      ExternalVideosScreen(load: offline))));
    await tester.pumpAndSettle();
    expect(find.text('Videos offline or unavailable'), findsOneWidget);

    final video = ExternalVideo.fromJson(data);
    Future<List<ExternalVideo>> loaded({String? provider}) async => [video];
    Uri? opened;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body:
      ExternalVideosScreen(load: loaded,
        checkAvailability: (_) async => true,
        embedBuilder: (_) => const Text('Provider iframe'),
        open: (url) async { opened = url; return true; }))));
    await tester.pumpAndSettle();
    expect(find.text('Tutor · youtube'), findsOneWidget);
    await tester.tap(find.text('Maths'));
    await tester.pumpAndSettle();
    expect(find.text('Play official video'), findsOneWidget);
    await tester.tap(find.text('Play official video'));
    await tester.pump();
    expect(find.text('Provider iframe'), findsOneWidget);
    await tester.ensureVisible(find.text('Open in youtube'));
    await tester.pump();
    await tester.tap(find.text('Open in youtube'));
    await tester.pump();
    expect(opened, video.sourceUrl);
  });
  testWidgets('disabled state never loads catalog', (tester) async {
    var calls = 0;
    Future<List<ExternalVideo>> loaded({String? provider}) async {
      calls++; return [];
    }
    await tester.pumpWidget(MaterialApp(home: Scaffold(body:
      ExternalVideosScreen(load: loaded, enabled: false))));
    expect(find.text('Videos are currently unavailable'), findsOneWidget);
    expect(calls, 0);
  });
  test('page metadata requires approved items and a matching cursor', () {
    final first = ExternalVideo.fromJson(data);
    final page = VideoCatalogPage.fromJson({
      'items': [data], 'nextCursor': first.id,
    });
    expect(page.items.single.sourceUrl, first.sourceUrl);
    expect(page.nextCursor, first.id);
    expect(() => VideoCatalogPage.fromJson({
      'items': [data], 'nextCursor': 'foreign-cursor',
    }), throwsFormatException);
    expect(() => VideoCatalogPage.fromJson({
      'items': [{...data, 'reviewState': 'pending'}],
      'nextCursor': null,
    }), throwsFormatException);
  });

  testWidgets('catalog page load, dedupe and account switch erase prior page',
      (tester) async {
    final one = ExternalVideo.fromJson(data);
    final two = ExternalVideo.fromJson({
      ...data, 'id': '2', 'title': 'Physics',
    });
    var firstPageCalls = 0;
    Future<List<ExternalVideo>> first({String? provider}) async => [one];
    Future<VideoCatalogPage> pages({String? provider, String? before}) async {
      if (before == null) {
        firstPageCalls++;
        return VideoCatalogPage(items: [one], nextCursor: one.id);
      }
      return VideoCatalogPage(items: [one, two], nextCursor: null);
    }
    Widget build(String account) => MaterialApp(home: Scaffold(body:
      ExternalVideosScreen(
        accountKey: account, load: first, loadPage: pages,
      )));
    await tester.pumpWidget(build('a'));
    await tester.pumpAndSettle();
    expect(find.text('Load more'), findsOneWidget);
    await tester.tap(find.text('Load more'));
    await tester.pumpAndSettle();
    expect(find.text('Physics'), findsOneWidget);
    expect(find.text('Maths'), findsOneWidget);
    expect(find.text('Load more'), findsNothing);
    await tester.pumpWidget(build('b'));
    await tester.pumpAndSettle();
    expect(firstPageCalls, 2);
    expect(find.text('Physics'), findsNothing);
    expect(find.text('Load more'), findsOneWidget);
  });
}
