import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_models.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_page.dart';
import 'package:masanawa_admin/src/theme/masanawa_theme.dart';

void main() {
  final projection = HomeRoomsPublishingProjection(
    revision: 5,
    storySeries: const [
      StoryRadioAdminItem(seriesId: 'series-1', title: 'Northern Tales', published: true, sortOrder: 1),
    ],
    newsCategories: const [
      NewsCategoryAdminItem(categoryId: 'world', label: 'World', visible: true, sortOrder: 1, pinnedItemId: null),
    ],
    homeRooms: const [
      HomeRoomAdminItem(roomKey: 'study-center', label: 'Study Center', visible: true, sortOrder: 1),
    ],
    assistants: const [
      AssistantHomePresentation(characterId: 'character-1', displayName: 'Gwana', position: 'left', visible: true),
    ],
  );

  testWidgets('emits revision-bound publishing mutation', (tester) async {
    PublishingMutationIntent? mutation;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: Scaffold(
          body: HomeRoomsPublishingPage(
            projection: projection,
            loading: false,
            onMutation: (value) => mutation = value,
          ),
        ),
      ),
    );

    expect(find.text('Northern Tales'), findsOneWidget);
    expect(find.text('Study Center'), findsOneWidget);

    await tester.tap(find.byType(Switch).first);
    await tester.pump();

    expect(mutation?.kind, PublishingMutationKind.setStoryVisibility);
    expect(mutation?.targetId, 'series-1');
    expect(mutation?.expectedRevision, 5);
  });

  testWidgets('renders retryable error state', (tester) async {
    var retries = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: Scaffold(
          body: HomeRoomsPublishingPage(
            projection: null,
            loading: false,
            errorMessage: 'Publishing controls unavailable.',
            onRetry: () => retries++,
          ),
        ),
      ),
    );

    expect(find.text('Publishing controls unavailable.'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    expect(retries, 1);
  });
}
