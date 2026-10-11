import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/search/search_repository.dart';
import 'package:masanawa/src/features/search/search_screen.dart';

class StubSearch implements SearchRepository {
  final calls = <String>[];
  Completer<SearchPage>? pending;
  bool fail = false;
  @override
  Future<SearchPage> search(String query, SearchFacet kind, {String? cursor}) {
    calls.add(query + ':' + kind.apiValue + ':' + (cursor ?? ''));
    if (pending != null) return pending!.future;
    if (fail) return Future.error(StateError('unavailable'));
    return Future.value(SearchPage([
      SearchHit(kind: kind, id: 'room_1', title: 'Maths & Coding', subtitle: 'Teacher'),
    ], null));
  }
}
void main() {
  Widget app(StubSearch repo, {String session = 'fan_a', ValueChanged<SearchHit>? open}) =>
    MaterialApp(home: SearchScreen(repository: repo, sessionKey: session, onOpen: open));
  testWidgets('C26 searches one public facet and opens a real selected result', (tester) async {
    final repo = StubSearch();
    SearchHit? opened;
    await tester.pumpWidget(app(repo, open: (hit) => opened = hit));
    await tester.enterText(find.byType(TextField), 'math');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(repo.calls, ['math:masana:']);
    expect(find.text('Maths & Coding'), findsOneWidget);
    await tester.tap(find.text('Maths & Coding'));
    expect(opened?.id, 'room_1');
    await tester.tap(find.text('Rooms'));
    await tester.pumpAndSettle();
    expect(repo.calls.last, 'math:rooms:');
  });
  testWidgets('account switch clears private in-flight projection', (tester) async {
    final repo = StubSearch()..pending = Completer<SearchPage>();
    await tester.pumpWidget(app(repo));
    await tester.enterText(find.byType(TextField), 'math');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpWidget(app(repo, session: 'fan_b'));
    repo.pending!.complete(SearchPage([
      const SearchHit(kind: SearchFacet.masana, id: 'masana_old',
        title: 'Old account data', subtitle: 'Should never display'),
    ], null));
    await tester.pumpAndSettle();
    expect(find.text('Old account data'), findsNothing);
    expect(find.text('Enter at least two letters to search.'), findsOneWidget);
  });
  testWidgets('error provides retry and never reports an empty successful query', (tester) async {
    final repo = StubSearch()..fail = true;
    await tester.pumpWidget(app(repo));
    await tester.enterText(find.byType(TextField), 'math');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Could not load search results.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    repo.fail = false;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('Maths & Coding'), findsOneWidget);
  });
}
