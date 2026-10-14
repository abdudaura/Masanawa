import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/screens/chat/masana_profile_screen.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

const _amina = AgentDirectoryEntry(
  characterId: 'character-medical',
  characterVersionId: 'version-1',
  displayName: 'Dr. Amina Yusuf',
  roleLabel: 'Medicine & Surgery',
  about: 'Explains anatomy and medical education. An AI educator.',
  presence: AgentPresence.available,
  roomId: 'room_masana_02_amina',
);

void main() {
  for (final textScale in [1.0, 1.5]) {
    testWidgets('Masana avatar opens exact professional profile at 320px, $textScale scale', (tester) async {
      tester.view.physicalSize = const Size(320, 720);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      var calls = 0;

      await tester.pumpWidget(MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        home: Builder(builder: (context) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.linear(textScale),
          ),
          child: Scaffold(body: Center(child: FilledButton(
            child: const Text('Open Amina'),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => MasanaProfileScreen(
                agent: _amina, onCall: () { calls++; },
              ),
            )),
          ))),
        )),
      ));

      await tester.tap(find.text('Open Amina'));
      await tester.pumpAndSettle();
      expect(find.text('Dr. Amina Yusuf'), findsOneWidget);
      expect(find.text('Medicine & Surgery'), findsWidgets);
      expect(find.textContaining('Explains anatomy'), findsOneWidget);
      expect(find.text('AI Masana'), findsOneWidget);
      expect(find.text('Classroom'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.ensureVisible(find.text('Call'));
      await tester.tap(find.text('Call'));
      await tester.pumpAndSettle();
      expect(calls, 1);
      expect(find.text('Open Amina'), findsOneWidget);
    });
  }
}
