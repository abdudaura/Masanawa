import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/activity/talk_activity.dart';
import 'package:masanawa/src/library/talk_library.dart';
import 'package:masanawa/src/screens/activity/activity_screen.dart';
import 'package:masanawa/src/screens/you/my_talks_screen.dart';
import 'package:masanawa/src/screens/you/saved_talks_screen.dart';
import 'package:masanawa/src/state/talk_activity_state.dart';
import 'package:masanawa/src/state/talk_library_state.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

Widget _host(List<Override> overrides, Widget child) => ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        theme: buildMasanawaTheme(brightness: Brightness.light),
        themeMode: ThemeMode.light,
        home: child,
      ),
    );

void main() {
  testWidgets('Activity uses the canonical white scaffold with real empty state',
      (tester) async {
    await tester.pumpWidget(_host([
      talkActivityProvider(TalkActivityFilter.all)
          .overrideWith((ref) async => <TalkActivityItem>[]),
    ], const ActivityScreen()));
    await tester.pump();
    final scaffold = tester.widget<Scaffold>(
      find.byKey(const ValueKey('talk-activity-screen')),
    );
    expect(scaffold.backgroundColor, Colors.white);
    expect(find.text('Activity'), findsOneWidget);
  });

  testWidgets('Saved Talks keeps white background during loading and empty states',
      (tester) async {
    await tester.pumpWidget(_host([
      savedTalksProvider.overrideWith(
        (ref) async => <TalkDiscoveryItem>[],
      ),
    ], const SavedTalksScreen()));
    await tester.pump();
    final scaffold = tester.widget<Scaffold>(
      find.byKey(const ValueKey('saved-talks-screen')),
    );
    expect(scaffold.backgroundColor, Colors.white);
    expect(find.text('Saved Talks'), findsOneWidget);
  });

  testWidgets('My Talks remains white when its provider cannot be reached',
      (tester) async {
    await tester.pumpWidget(_host([
      myTalksProvider.overrideWith(
        (ref) => Future<MyTalksView>.error(StateError('offline')),
      ),
    ], const MyTalksScreen()));
    await tester.pump();
    final scaffold = tester.widget<Scaffold>(
      find.byKey(const ValueKey('my-talks-screen')),
    );
    expect(scaffold.backgroundColor, Colors.white);
    expect(find.text('My Talks'), findsOneWidget);
  });
}
