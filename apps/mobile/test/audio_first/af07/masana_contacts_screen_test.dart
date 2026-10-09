import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_directory.dart';
import 'package:masanawa/src/masana_contacts/masana_contacts_screen.dart';

TwinDirectoryEntry _masana(String id, String name) => TwinDirectoryEntry(
  publicId: id,
  characterId: 'character-' + id,
  displayName: name,
  bio: 'A public Masana persona',
  languages: const ['en'],
  voiceEnabled: true,
  ownerAccessEnabled: false,
  publicUrl: null,
);

class _PublicDirectory implements TwinDirectoryTransport {
  int searches = 0;
  int resolutions = 0;
  Future<TwinDirectoryPage> Function(String query)? searchHandler;
  Future<TwinDirectoryEntry?> Function(String publicId)? resolveHandler;

  @override
  Future<TwinDirectoryPage> search({
    required String query,
    String? cursor,
    int limit = 30,
  }) {
    searches++;
    if (searchHandler != null) return searchHandler!(query);
    return Future.value(TwinDirectoryPage(
      items: [_masana('gwani', 'Gwani')],
      nextCursor: null,
    ));
  }

  @override
  Future<TwinDirectoryEntry?> resolve({required String publicId}) {
    resolutions++;
    if (resolveHandler != null) return resolveHandler!(publicId);
    return Future.value(_masana(publicId, 'Gwani'));
  }
}

Widget _screen(
  _PublicDirectory source,
  List<TwinDirectoryEntry> opens, {
  String ownerId = 'account-a',
  bool Function(String)? isCurrent,
  WidgetBuilder? human,
}) => MaterialApp(
  home: MasanaContactsScreen(
    transport: source,
    accountId: ownerId,
    isCurrentAccount: isCurrent ?? (id) => id == ownerId,
    contactsBuilder: human ?? (context) =>
        const Center(child: Text('Accepted human contacts only')),
    onOpenMasana: opens.add,
  ),
);

void main() {
  testWidgets('Masana and people stay in separate destinations, verified public ID',
      (tester) async {
    final source = _PublicDirectory();
    final opened = <TwinDirectoryEntry>[];
    await tester.pumpWidget(_screen(source, opened));
    await tester.pumpAndSettle();
    expect(find.text('Masana & Contacts'), findsOneWidget);
    expect(find.text('Gwani'), findsOneWidget);
    expect(find.text('AI persona'), findsOneWidget);
    expect(source.resolutions, 0);

    await tester.tap(find.text('Contacts'));
    await tester.pumpAndSettle();
    expect(find.text('Accepted human contacts only'), findsOneWidget);
    expect(find.text('Gwani'), findsNothing);
    expect(opened, isEmpty);

    await tester.tap(find.text('Masana'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gwani'));
    await tester.pumpAndSettle();
    expect(source.resolutions, 1);
    expect(opened.map((e) => e.publicId), ['gwani']);
    expect(opened.single.characterId, 'character-gwani');
  });

  testWidgets('deleted or remapped Masana cannot open an old row',
      (tester) async {
    final source = _PublicDirectory()
      ..resolveHandler = (id) async => _masana('different', 'Imposter');
    final opened = <TwinDirectoryEntry>[];
    await tester.pumpWidget(_screen(source, opened));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gwani'));
    await tester.pumpAndSettle();
    expect(opened, isEmpty);
    expect(find.textContaining('no longer available'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('offline load exposes retry, not a fabricated AI contact',
      (tester) async {
    final source = _PublicDirectory()
      ..searchHandler = (query) => Future.error(StateError('offline'));
    final opened = <TwinDirectoryEntry>[];
    await tester.pumpWidget(_screen(source, opened));
    await tester.pumpAndSettle();
    expect(find.text('Gwani'), findsNothing);
    expect(find.textContaining('Could not load Masana'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(source.searches, 2);
    expect(opened, isEmpty);
  });

  testWidgets('stale search response cannot overwrite a newer query',
      (tester) async {
    final oldRead = Completer<TwinDirectoryPage>();
    final source = _PublicDirectory()
      ..searchHandler = (query) {
        if (query.isEmpty) return oldRead.future;
        return Future.value(TwinDirectoryPage(
          items: [_masana('amina', 'Amina')],
          nextCursor: null,
        ));
      };
    final opened = <TwinDirectoryEntry>[];
    await tester.pumpWidget(_screen(source, opened));
    await tester.pump();
    await tester.enterText(find.byKey(const Key('masanaDirectorySearch')), 'Ami');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
    expect(find.text('Amina'), findsOneWidget);
    oldRead.complete(TwinDirectoryPage(
      items: [_masana('gwani', 'Gwani')],
      nextCursor: null,
    ));
    await tester.pumpAndSettle();
    expect(find.text('Amina'), findsOneWidget);
    expect(find.text('Gwani'), findsNothing);
  });

  testWidgets('account switch during verify prevents old-account navigation',
      (tester) async {
    final resolving = Completer<TwinDirectoryEntry?>();
    final source = _PublicDirectory()
      ..resolveHandler = (id) => resolving.future;
    final opened = <TwinDirectoryEntry>[];
    await tester.pumpWidget(_screen(source, opened));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Gwani'));
    await tester.pump();
    expect(source.resolutions, 1);

    await tester.pumpWidget(_screen(source, opened, ownerId: 'account-b'));
    await tester.pump();
    resolving.complete(_masana('gwani', 'Gwani'));
    await tester.pumpAndSettle();
    expect(opened, isEmpty);
    expect(find.text('Masana & Contacts'), findsOneWidget);
  });

  testWidgets('signed-out session never loads or opens a public row',
      (tester) async {
    final source = _PublicDirectory();
    final opened = <TwinDirectoryEntry>[];
    await tester.pumpWidget(_screen(
      source, opened, isCurrent: (_) => false,
    ));
    await tester.pumpAndSettle();
    expect(find.text('Sign in to view your directory.'), findsOneWidget);
    expect(source.searches, 0);
    expect(opened, isEmpty);
  });
}
