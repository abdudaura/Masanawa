import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/unified_discovery/public_discovery_controller.dart';
import 'package:masanawa/src/unified_discovery/public_discovery_models.dart';
import 'package:masanawa/src/unified_discovery/public_discovery_screen.dart';
import 'package:masanawa/src/unified_discovery/public_discovery_transport.dart';

class _FakeTransport implements PublicDiscoveryTransport {
  final calls = <String>[];
  final pending = <Completer<PublicDiscoveryPage>>[];
  @override
  Future<PublicDiscoveryPage> search({
    required String query, required PublicDiscoveryFilter filter,
    required bool liveOnly, required int offset,
  }) {
    calls.add('$query/${filter.name}/$liveOnly/$offset');
    final next = Completer<PublicDiscoveryPage>();
    pending.add(next);
    return next.future;
  }
}

PublicDiscoveryPage _page(List<PublicDiscoveryItem> items, {int? next}) =>
    PublicDiscoveryPage(items: items, nextOffset: next,
        searchWindowSaturated: false);

const _person = PublicDiscoveryItem(
  kind: PublicDiscoveryKind.person, id: 'amina', title: 'Amina',
  subtitle: '@amina', isLive: false,
);
const _talk = PublicDiscoveryItem(
  kind: PublicDiscoveryKind.talk, id: 'talk_1', title: 'Education',
  subtitle: 'Amina', isLive: true, listenerCount: 9,
);

void main() {
  test('parses typed target and refuses private or path-injection results', () {
    final item = PublicDiscoveryItem.fromJson({
      'kind': 'person', 'id': 'amina', 'title': 'Amina',
      'subtitle': '@amina', 'isLive': false,
    });
    expect(item.route, '/u/amina');
    expect(() => PublicDiscoveryItem.fromJson({
      'kind': 'message', 'id': 'secret', 'title': 'Secret',
      'subtitle': 'Private', 'isLive': false,
    }), throwsFormatException);
    expect(() => PublicDiscoveryItem.fromJson({
      'kind': 'talk', 'id': '../private', 'title': 'Unsafe',
      'subtitle': 'bad', 'isLive': true, 'listenerCount': 1,
    }), throwsFormatException);
    expect(() => PublicDiscoveryPage.fromJson({
      'items': [], 'nextOffset': 999, 'searchWindowSaturated': false,
    }), throwsFormatException);
  });

  test('old query response cannot replace a newer user query', () async {
    final transport = _FakeTransport();
    final controller = PublicDiscoveryController(
      transport: transport, ownerId: 'a', isCurrentOwner: (owner) => true,
    );
    final old = controller.search('amina');
    final newer = controller.search('education');
    transport.pending[1].complete(_page([_talk]));
    await newer;
    transport.pending[0].complete(_page([_person]));
    await old;
    expect(controller.items.single.id, 'talk_1');
    controller.dispose();
  });

  test('discards pending response after account switch and clears on dispose', () async {
    var owner = 'a';
    final transport = _FakeTransport();
    final controller = PublicDiscoveryController(
      transport: transport, ownerId: 'a',
      isCurrentOwner: (expected) => owner == expected,
    );
    final pending = controller.search('amina');
    owner = 'b';
    transport.pending.single.complete(_page([_person]));
    await pending;
    expect(controller.items, isEmpty);
    controller.dispose();
  });

  test('preserves loaded page and cursor after uncertain load-more failure', () async {
    final transport = _FakeTransport();
    final controller = PublicDiscoveryController(
      transport: transport, ownerId: 'a', isCurrentOwner: (_) => true,
    );
    final first = controller.search('education');
    transport.pending[0].complete(_page([_talk], next: 20));
    await first;
    final more = controller.loadMore();
    transport.pending[1].completeError(Exception('offline'));
    await more;
    expect(controller.items.single.id, 'talk_1');
    expect(controller.nextOffset, 20);
    expect(controller.error, isNotNull);
    controller.dispose();
  });

  testWidgets('public discovery only opens typed safe routes', (tester) async {
    final transport = _FakeTransport();
    final opened = <String>[];
    await tester.pumpWidget(MaterialApp(home: PublicDiscoveryScreen(
      transport: transport, ownerId: 'a',
      isCurrentOwner: (_) => true, openRoute: opened.add,
    )));
    await tester.enterText(find.byType(TextField), 'amina');
    await tester.tap(find.byTooltip('Search'));
    await tester.pump();
    transport.pending.single.complete(_page([_person, _talk]));
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsOneWidget);
    await tester.tap(find.text('Amina'));
    expect(opened, ['/u/amina']);
  });

  testWidgets('switching account removes all old public results', (tester) async {
    final transport = _FakeTransport();
    String owner = 'a';
    Widget build() => MaterialApp(home: PublicDiscoveryScreen(
      transport: transport, ownerId: owner,
      isCurrentOwner: (id) => owner == id, openRoute: (_) {},
    ));
    await tester.pumpWidget(build());
    await tester.enterText(find.byType(TextField), 'amina');
    await tester.tap(find.byTooltip('Search'));
    await tester.pump();
    transport.pending.single.complete(_page([_person]));
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsOneWidget);
    owner = 'b';
    await tester.pumpWidget(build());
    expect(find.text('Amina'), findsNothing);
    expect(find.text('Enter at least two characters.'), findsOneWidget);
  });
}
