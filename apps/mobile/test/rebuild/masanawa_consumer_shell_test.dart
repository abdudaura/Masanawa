import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/app/masanawa_consumer_shell.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('J02 screen shows only five canonical bottom tabs, Chats launch and Status second', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    await tester.pumpWidget(const ProviderScope(
      child: MaterialApp(home: MasanawaConsumerShell(initialTab: MasanawaTab.rooms)),
    ));
    await tester.pump();
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    expect(bar.selectedIndex, 4);
    final labels = tester.widgetList<NavigationDestination>(
      find.byType(NavigationDestination),
    ).map((destination) => destination.label).toList();
    expect(labels, ['Chats', 'Status', 'Wallet', 'Calls', 'Rooms']);
    expect(MasanawaTab.parse(null), MasanawaTab.chats);
    expect(MasanawaTab.parse('status').index, 1);
    expect(find.text('Talk'), findsNothing);
    expect(find.text('Twins'), findsNothing);
    expect(find.byTooltip('Start Talk'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('J08 unqualified Rooms cannot offer pay/join/create affordance', (tester) async {
    FlutterSecureStorage.setMockInitialValues({});
    await tester.pumpWidget(const ProviderScope(
      child: MaterialApp(home: MasanawaConsumerShell(initialTab: MasanawaTab.rooms)),
    ));
    await tester.pump();
    expect(find.text('Rooms are not available yet.'), findsOneWidget);
    expect(find.text('Pay now'), findsNothing);
    expect(find.text('Create Room'), findsNothing);
    expect(find.text('Subscribe'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
