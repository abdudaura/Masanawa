import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_models.dart';
import 'package:masanawa_admin/src/home_rooms_publishing/home_rooms_publishing_page.dart';
import 'package:masanawa_admin/src/theme/masanawa_theme.dart';

void main() {
  final projection = HomeRoomsPublishingProjection(
    revision: 5,
    storySeries: const [
      StoryRadioAdminItem(
        seriesId: 'series-1',
        title: 'Northern Tales',
        published: true,
        sortOrder: 1,
      ),
    ],
    newsCategories: const [
      NewsCategoryAdminItem(
        categoryId: 'world',
        label: 'World',
        visible: true,
        sortOrder: 1,
        pinnedItemId: null,
      ),
    ],
    homeRooms: const [
      HomeRoomAdminItem(
        roomKey: 'study-center',
        label: 'Study Center',
        visible: true,
        sortOrder: 1,
      ),
    ],
    assistants: const [
      AssistantHomePresentation(
        characterId: 'character-1',
        displayName: 'Gwana',
        position: 'left',
        visible: true,
      ),
    ],
  );

  Widget page({
    ValueChanged<PublishingMutationIntent>? onMutation,
    bool saving = false,
  }) =>
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: Scaffold(
          body: HomeRoomsPublishingPage(
            projection: projection,
            loading: false,
            saving: saving,
            onMutation: onMutation,
          ),
        ),
      );

  testWidgets('emits revision-bound visibility mutation', (tester) async {
    PublishingMutationIntent? mutation;
    await tester.pumpWidget(page(onMutation: (value) => mutation = value));

    expect(find.text('Northern Tales'), findsOneWidget);
    expect(find.text('Study Center'), findsOneWidget);

    await tester.tap(find.byType(Switch).first);
    await tester.pump();

    expect(mutation?.kind, PublishingMutationKind.setStoryVisibility);
    expect(mutation?.targetId, 'series-1');
    expect(mutation?.expectedRevision, 5);
  });

  testWidgets('emits room reordering mutation', (tester) async {
    PublishingMutationIntent? mutation;
    await tester.pumpWidget(page(onMutation: (value) => mutation = value));

    await tester.scrollUntilVisible(find.byTooltip('Move later'), 250);
    await tester.tap(find.byTooltip('Move later'));
    await tester.pump();

    expect(mutation?.kind, PublishingMutationKind.reorderHomeRoom);
    expect(mutation?.targetId, 'study-center');
    expect(mutation?.sortOrder, 2);
    expect(mutation?.expectedRevision, 5);
  });

  testWidgets('emits news pinning mutation from dialog', (tester) async {
    PublishingMutationIntent? mutation;
    await tester.pumpWidget(page(onMutation: (value) => mutation = value));

    await tester.scrollUntilVisible(
      find.byTooltip('Change pinned article'),
      250,
    );
    await tester.tap(find.byTooltip('Change pinned article'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'news-42');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(mutation?.kind, PublishingMutationKind.pinNewsItem);
    expect(mutation?.targetId, 'world');
    expect(mutation?.pinnedItemId, 'news-42');
    expect(mutation?.expectedRevision, 5);
  });

  testWidgets('emits assistant presentation mutation from dialog',
      (tester) async {
    PublishingMutationIntent? mutation;
    await tester.pumpWidget(page(onMutation: (value) => mutation = value));

    await tester.scrollUntilVisible(
      find.byTooltip('Edit assistant presentation'),
      300,
    );
    await tester.tap(find.byTooltip('Edit assistant presentation'));
    await tester.pumpAndSettle();

    final field = find.byType(TextField);
    expect(field, findsOneWidget);
    await tester.enterText(field, 'Gwana Home');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(mutation?.kind, PublishingMutationKind.updateAssistantPresentation);
    expect(mutation?.targetId, 'character-1');
    expect(mutation?.displayName, 'Gwana Home');
    expect(mutation?.position, 'left');
    expect(mutation?.visible, isTrue);
    expect(mutation?.expectedRevision, 5);
  });

  testWidgets('disables all mutation controls while saving', (tester) async {
    await tester.pumpWidget(page(onMutation: (_) {}, saving: true));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final switches = tester.widgetList<Switch>(find.byType(Switch));
    expect(switches.every((widget) => widget.onChanged == null), isTrue);

    await tester.scrollUntilVisible(find.byTooltip('Move later'), 250);
    final moveLater = tester.widget<IconButton>(find.byTooltip('Move later'));
    expect(moveLater.onPressed, isNull);
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
