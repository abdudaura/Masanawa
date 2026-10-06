import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/work_research/work_research_models.dart';
import 'package:masanawa/src/rooms/work_research/work_research_room_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

void main() {
  WorkResearchRoomProjection projection() => WorkResearchRoomProjection(
        kind: WorkResearchRoomKind.workBusiness,
        title: 'Work & Business',
        subtitle: 'Get practical work done.',
        quickStarts: const [
          WorkResearchQuickStart(
            intentId: 'prepare-document',
            label: 'Prepare a document',
            description: 'Draft or improve a useful document.',
            iconKey: 'document',
          ),
        ],
        items: const [
          WorkResearchItem(
            itemId: 'work-1',
            title: 'Proposal draft',
            summary: 'Preparing the first draft.',
            status: WorkResearchItemStatus.working,
            progress: .4,
            artifacts: [
              WorkResearchArtifact(
                artifactId: 'a-1',
                label: 'Proposal.docx',
                kind: 'document',
              ),
            ],
            evidence: [],
          ),
        ],
      );

  testWidgets('renders projection and emits typed quick-start action', (tester) async {
    WorkResearchQuickStart? selected;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: WorkResearchRoomScreen(
          kind: WorkResearchRoomKind.workBusiness,
          projection: projection(),
          loading: false,
          onQuickStart: (value) => selected = value,
        ),
      ),
    );

    expect(find.text('Work & Business'), findsWidgets);
    expect(find.text('Prepare a document'), findsOneWidget);
    expect(find.text('Proposal draft'), findsOneWidget);

    await tester.tap(find.text('Prepare a document'));
    await tester.pump();

    expect(selected?.intentId, 'prepare-document');
  });

  testWidgets('renders isolated error state without needing transport', (tester) async {
    var retries = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: WorkResearchRoomScreen(
          kind: WorkResearchRoomKind.researchAnswers,
          projection: null,
          loading: false,
          errorMessage: 'Research is unavailable.',
          onRetry: () => retries++,
        ),
      ),
    );

    expect(find.text('Research is unavailable.'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    expect(retries, 1);
  });
}
