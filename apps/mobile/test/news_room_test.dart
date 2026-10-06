import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/news/news_models.dart';
import 'package:masanawa/src/rooms/news/news_room.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

Map<String, dynamic> _projectionJson() => {
      'updatedAt': '2026-10-06T09:00:00Z',
      'featuredItemId': 'n1',
      'categories': [
        {'id': 'world', 'label': 'World', 'order': 0, 'visible': true},
        {'id': 'hidden', 'label': 'Hidden', 'order': 1, 'visible': false},
      ],
      'items': [
        {
          'id': 'n1',
          'title': 'Verified headline',
          'summary': 'A concise sourced summary.',
          'body': 'Full sourced article projection.',
          'categoryId': 'world',
          'publishedAt': '2026-10-06T08:30:00Z',
          'visible': true,
          'pinned': true,
          'evidenceRefs': ['evidence:123'],
          'sources': [
            {
              'label': 'Primary report',
              'publisher': 'Example News',
              'url': 'https://example.com/report',
            }
          ],
          'audio': {
            'assetUrl': 'https://cdn.example.com/audio/n1.m4a',
            'durationSeconds': 65,
          },
        },
        {
          'id': 'n2',
          'title': 'Hidden category item',
          'summary': 'Not visible through the room.',
          'body': 'Body',
          'categoryId': 'hidden',
          'publishedAt': '2026-10-06T08:00:00Z',
          'visible': true,
          'pinned': false,
          'sources': [
            {
              'label': 'Source',
              'url': 'https://example.com/hidden',
            }
          ],
        },
      ],
    };

void main() {
  test('parses source-aware News projection and filters hidden categories', () {
    final projection = NewsRoomProjection.fromJson(_projectionJson());

    expect(projection.categories.map((e) => e.id), ['world']);
    expect(projection.items.map((e) => e.id), ['n1']);
    expect(projection.featuredItem?.id, 'n1');
    expect(projection.items.first.sources.single.url.scheme, 'https');
    expect(projection.items.first.audio?.durationSeconds, 65);
  });

  test('rejects unsourced news rather than rendering generated current claims', () {
    final json = _projectionJson();
    final item = Map<String, dynamic>.from(
      (json['items'] as List).first as Map<String, dynamic>,
    )..['sources'] = [];

    json['items'] = [item];

    expect(
      () => NewsRoomProjection.fromJson(json),
      throwsA(isA<FormatException>()),
    );
  });

  testWidgets('renders category/source metadata and delegates article navigation',
      (tester) async {
    final projection = NewsRoomProjection.fromJson(_projectionJson());
    NewsItem? opened;

    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: Scaffold(
          body: NewsRoomView(
            projection: projection,
            onOpenItem: (item) => opened = item,
          ),
        ),
      ),
    );

    expect(find.text('News'), findsOneWidget);
    expect(find.text('World'), findsOneWidget);
    expect(find.text('Top story'), findsOneWidget);
    expect(find.text('Example News'), findsOneWidget);

    await tester.tap(find.text('Verified headline'));
    await tester.pump();

    expect(opened?.id, 'n1');
  });
}
