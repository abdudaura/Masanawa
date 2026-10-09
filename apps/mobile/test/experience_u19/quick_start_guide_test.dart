import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/experience_quality/quick_start_copy.dart';
import 'package:masanawa/src/experience_quality/quick_start_guide.dart';

void main() {
  test('local Hausa copy is explicit; other unsupported locales fall back', () {
    final ha = QuickStartCopy.forLocale(const Locale('ha'));
    final en = QuickStartCopy.forLocale(const Locale('en'));
    expect(ha.title, isNot(en.title));
    expect(ha.targetTitle(QuickStartTarget.chats), isNot('Chats'));
    expect(QuickStartCopy.forLocale(const Locale('es')).title, en.title,
        reason: 'Never claim full R11 translation from this isolated feature');
  });

  testWidgets('tap and typed draft require review, never auto-send or mic',
      (tester) async {
    final launches = <QuickStartLaunch>[];
    var skips = 0;
    await tester.pumpWidget(MaterialApp(home: ExperienceQuickStartGuide(
      accountScope: 'session-A',
      onOpen: launches.add,
      onSkip: () => skips++,
    )));
    expect(find.byKey(const ValueKey('u19-continue')), findsOneWidget);
    expect(tester.widget<FilledButton>(
        find.byKey(const ValueKey('u19-continue'))).onPressed, isNull);
    expect(launches, isEmpty);

    final selection = find.byKey(const ValueKey('u19-target-assistant'));
    await tester.ensureVisible(selection);
    await tester.tap(selection);
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey('u19-draft')),
        'Please explain this in Hausa');
    await tester.tap(find.byKey(const ValueKey('u19-continue')));
    await tester.pump();
    expect(find.text('Review before opening'), findsOneWidget);
    expect(launches, isEmpty);
    expect(find.textContaining('will not start audio'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('u19-back')));
    await tester.pump();
    expect(launches, isEmpty);
    await tester.tap(find.byKey(const ValueKey('u19-continue')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('u19-continue')));
    expect(launches, hasLength(1));
    expect(launches.single.target, QuickStartTarget.assistant);
    expect(launches.single.unsentDraft, 'Please explain this in Hausa');
    expect(skips, 0);
  });

  testWidgets('account switch drops staged text, choice and review state',
      (tester) async {
    Widget host(String account) => MaterialApp(
      home: ExperienceQuickStartGuide(accountScope: account, onOpen: (_) {}),
    );
    await tester.pumpWidget(host('A'));
    await tester.tap(find.byKey(const ValueKey('u19-target-talks')));
    await tester.enterText(find.byKey(const ValueKey('u19-draft')),
        'Private text for A');
    await tester.tap(find.byKey(const ValueKey('u19-continue')));
    await tester.pump();
    expect(find.text('Review before opening'), findsOneWidget);

    await tester.pumpWidget(host('B'));
    await tester.pump();
    expect(find.text('Find your way in Masanawa'), findsOneWidget);
    expect(tester.widget<TextField>(find.byKey(const ValueKey('u19-draft')))
        .controller!.text, isEmpty);
    expect(tester.widget<FilledButton>(
        find.byKey(const ValueKey('u19-continue'))).onPressed, isNull);
    expect(find.text('Private text for A'), findsNothing);
  });

  testWidgets('compact handset + large text remain scrollable without overflow',
      (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(home: MediaQuery(
      data: const MediaQueryData(
          size: Size(320, 568), textScaler: TextScaler.linear(1.8)),
      child: ExperienceQuickStartGuide(
        accountScope: 'A',
        localeOverride: const Locale('ha'),
        onOpen: (_) {},
      ),
    )));
    await tester.pump();
    expect(find.byType(ListView), findsOneWidget);
    expect(find.text('Fara amfani da Masanawa'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('skip is opt-in and does not emit a launch', (tester) async {
    final launches = <QuickStartLaunch>[];
    var skipped = false;
    await tester.pumpWidget(MaterialApp(home: ExperienceQuickStartGuide(
      accountScope: 'A', onOpen: launches.add,
      onSkip: () => skipped = true,
    )));
    await tester.tap(find.text('Skip'));
    expect(skipped, isTrue);
    expect(launches, isEmpty);
  });
}
