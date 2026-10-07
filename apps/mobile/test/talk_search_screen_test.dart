import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/screens/search/talk_search_screen.dart';
import 'package:masanawa/src/search/talk_search.dart';
import 'package:masanawa/src/state/talk_search_state.dart';
import 'package:masanawa/src/talks/talk_models.dart';
import 'package:masanawa/src/theme/masanawa_theme.dart';

class _SearchTransport implements TalkSearchTransport {
  final List<TalkSearchFilter> filters = [];

  @override
  Future<TalkSearchResults> search({
    required String query,
    required TalkSearchFilter filter,
    int limit = 30,
  }) async {
    filters.add(filter);
    if (filter == TalkSearchFilter.people) {
      return const TalkSearchResults(
        people: [
          TalkSearchPerson(
            handle: 'amina',
            displayName: 'Amina',
            bio: 'Host',
            isLive: true,
          ),
        ],
      );
    }
    if (filter == TalkSearchFilter.experts) {
      return const TalkSearchResults(
        personas: [
          TalkSearchPersona(
            publicId: 'economist',
            displayName: 'Economist',
            kind: TalkSearchPersonaKind.expert,
            seatFeeLabel: '₦300',
            isAvailable: true,
            role: 'Economy',
          ),
        ],
      );
    }
    return const TalkSearchResults(
      talks: [
        TalkDiscoveryItem(
          id: 'talk-1',
          title: 'AI and the future of work',
          hostName: 'Musa',
          isLive: true,
          listenerCount: 1200,
        ),
      ],
      people: [
        TalkSearchPerson(
          handle: 'amina',
          displayName: 'Amina',
          bio: 'Host',
          isLive: true,
        ),
      ],
      personas: [
        TalkSearchPersona(
          publicId: 'economist',
          displayName: 'Economist',
          kind: TalkSearchPersonaKind.expert,
          seatFeeLabel: '₦300',
          isAvailable: true,
          role: 'Economy',
        ),
      ],
    );
  }
}

class _FailingSearchTransport implements TalkSearchTransport {
  @override
  Future<TalkSearchResults> search({
    required String query,
    required TalkSearchFilter filter,
    int limit = 30,
  }) {
    throw Exception('DioException socket failed');
  }
}

Widget _app({
  required TalkSearchTransport transport,
  String initialQuery = 'ai',
  void Function(TalkDiscoveryItem)? onOpenTalk,
  void Function(String)? onOpenPerson,
  void Function(String)? onOpenPersona,
}) {
  return ProviderScope(
    overrides: [
      talkSearchTransportProvider.overrideWithValue(transport),
    ],
    child: MaterialApp(
      theme: buildMasanawaTheme(brightness: Brightness.light),
      home: TalkSearchScreen(
        initialQuery: initialQuery,
        onOpenTalk: onOpenTalk,
        onOpenPerson: onOpenPerson,
        onOpenPersona: onOpenPersona,
      ),
    ),
  );
}

void main() {
  testWidgets('search has one compact filter row and mixed results',
      (tester) async {
    final transport = _SearchTransport();
    await tester.pumpWidget(_app(transport: transport));
    await tester.pumpAndSettle();

    expect(find.text('All'), findsOneWidget);
    expect(find.text('Talks'), findsOneWidget);
    expect(find.text('People'), findsOneWidget);
    expect(find.text('Experts'), findsOneWidget);
    expect(find.text('Twins'), findsOneWidget);

    expect(find.text('AI and the future of work'), findsOneWidget);
    expect(find.text('Amina'), findsOneWidget);
    expect(find.text('Economist'), findsOneWidget);
    expect(find.byType(GridView), findsNothing);
  });

  testWidgets('filter changes request the matching search projection',
      (tester) async {
    final transport = _SearchTransport();
    await tester.pumpWidget(_app(transport: transport));
    await tester.pumpAndSettle();

    await tester.tap(find.text('People'));
    await tester.pumpAndSettle();

    expect(transport.filters, contains(TalkSearchFilter.people));
    expect(find.text('Amina'), findsOneWidget);
    expect(find.text('Economist'), findsNothing);

    await tester.tap(find.text('Experts'));
    await tester.pumpAndSettle();

    expect(transport.filters, contains(TalkSearchFilter.experts));
    expect(find.text('Economist'), findsOneWidget);
  });

  testWidgets('results open canonical Talk/person/persona targets',
      (tester) async {
    final transport = _SearchTransport();
    String? talk;
    String? person;
    String? persona;

    await tester.pumpWidget(
      _app(
        transport: transport,
        onOpenTalk: (value) => talk = value.id,
        onOpenPerson: (value) => person = value,
        onOpenPersona: (value) => persona = value,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('AI and the future of work'));
    expect(talk, 'talk-1');

    await tester.tap(find.text('Amina'));
    expect(person, 'amina');

    await tester.tap(find.text('Economist'));
    expect(persona, 'economist');
  });

  testWidgets('search hides raw transport failures', (tester) async {
    await tester.pumpWidget(
      _app(transport: _FailingSearchTransport()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Couldn’t search right now.'), findsOneWidget);
    expect(find.textContaining('DioException'), findsNothing);
    expect(find.textContaining('socket'), findsNothing);
  });

  testWidgets('one-letter query does not call transport', (tester) async {
    final transport = _SearchTransport();
    await tester.pumpWidget(
      _app(
        transport: transport,
        initialQuery: '',
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('talk-search-field')),
      'a',
    );
    await tester.pump(const Duration(milliseconds: 400));

    expect(transport.filters, isEmpty);
    expect(find.text('Search Masanawa'), findsOneWidget);
  });
}
