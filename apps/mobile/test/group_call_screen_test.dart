import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/group_call_controller.dart';
import 'package:masanawa/src/calls/group_call_screen.dart';
import 'package:masanawa/src/calls/group_call_transport.dart';
import 'group_call_controller_test.dart' as fakes;

void main() {
  testWidgets(
    'picker requires two, limits to four current contacts and shows empty directory guidance',
    (tester) async {
      final contacts = [
        for (var i = 0; i < 5; i++)
          GroupContact(
            characterId: 'c$i',
            displayName: 'Masana $i',
            supportAgent: true,
          ),
      ];
      final transport = fakes.Transport();
      final controller = GroupCallController(
        accountKey: 'owner',
        currentAccountKey: () => 'owner',
        transport: transport,
        contacts: contacts,
        microphone: fakes.Microphone(),
        player: fakes.Player(),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: GroupCallScreen(
            accountKey: 'owner',
            currentAccountKey: () => 'owner',
            contacts: contacts,
            transport: transport,
            controller: controller,
          ),
        ),
      );
      FilledButton start() => tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Start group call'),
      );
      expect(start().onPressed, isNull);
      await tester.tap(find.text('Masana 0'));
      await tester.pump();
      expect(start().onPressed, isNull);
      await tester.tap(find.text('Masana 1'));
      await tester.pump();
      expect(start().onPressed, isNotNull);
      await tester.tap(find.text('Masana 2'));
      await tester.tap(find.text('Masana 3'));
      await tester.tap(find.text('Masana 4'));
      await tester.pump();
      expect(
        tester
            .widgetList<CheckboxListTile>(find.byType(CheckboxListTile))
            .where((c) => c.value == true)
            .length,
        4,
      );
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
      final empty = fakes.Transport();
      final emptyController = GroupCallController(
        accountKey: 'owner',
        currentAccountKey: () => 'owner',
        transport: empty,
        contacts: [],
        microphone: fakes.Microphone(),
        player: fakes.Player(),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: GroupCallScreen(
            accountKey: 'owner',
            currentAccountKey: () => 'owner',
            contacts: [],
            transport: empty,
            controller: emptyController,
          ),
        ),
      );
      expect(
        find.text(
          'Add at least two current Masana contacts before starting a group call.',
        ),
        findsOneWidget,
      );
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    },
  );
  testWidgets(
    'changing signed-in owner signals account cleanup and shows ended state',
    (tester) async {
      final transport = fakes.Transport();
      String? account = 'owner';
      final controller = _AccountController(transport);
      Widget screen(String accountKey) => MaterialApp(
        home: GroupCallScreen(
          accountKey: accountKey,
          currentAccountKey: () => account,
          contacts: fakes.contacts,
          transport: transport,
          controller: controller,
        ),
      );
      await tester.pumpWidget(screen('owner'));
      account = 'other';
      await tester.pumpWidget(screen('other'));
      await tester.pump();
      expect(controller.accountChanges, 1);
      expect(find.text('Group call ended'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      await tester.pump();
    },
  );
}

class _AccountController extends GroupCallController {
  _AccountController(fakes.Transport transport)
    : super(
        transport: transport,
        accountKey: 'owner',
        currentAccountKey: () => 'owner',
        contacts: fakes.contacts,
        microphone: fakes.Microphone(),
        player: fakes.Player(),
      ) {
    this.group = fakes.group('active');
  }
  int accountChanges = 0;
  @override
  Future<void> accountChanged() async {
    accountChanges++;
    ended = true;
    notifyListeners();
  }

  @override
  Future<void> end() async {
    ended = true;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
