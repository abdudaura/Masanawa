import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/chat/shell_document.dart';
import 'package:masanawa/src/chat/shell_document_view.dart';
import 'package:masanawa/src/chat/message_parts.dart';

Map<String, dynamic> document({int version = 1}) => {
  'version': version,
  'id': 'quote-1',
  'revision': 3,
  'fallback': 'Choose a data bundle.',
  'expiresAt': '2099-01-01T00:00:00Z',
  'nodes': [
    {'type': 'input', 'id': 'phone', 'text': 'Phone', 'required': true},
    {
      'type': 'options',
      'children': [
        {
          'type': 'button',
          'id': 'buy',
          'text': '1 GB',
          'action': 'choose-bundle',
          'token': 'server-issued-token',
        },
      ],
    },
  ],
};

void main() {
  test('documents round trip without losing action scope', () {
    final parsed = ShellDocument.fromJson(document());
    expect(ShellDocument.fromJson(parsed.toJson()).revision, 3);
    expect(parsed.nodes.last.children.single.token, 'server-issued-token');
  });
  test('unsupported version retains readable part fallback', () {
    final part = AgentMessagePart.fromJson({
      'kind': 'future-kind',
      'document': document(version: 99),
    });
    expect(part.document, isNull);
    expect(part.body, 'Choose a data bundle.');
  });
  test('rejects duplicate ids, excessive trees and tokenless actions', () {
    final duplicate = document();
    duplicate['nodes'] = [
      {'type': 'text', 'id': 'same'},
      {'type': 'text', 'id': 'same'},
    ];
    expect(() => ShellDocument.fromJson(duplicate), throwsFormatException);
    final oversized = document();
    oversized['nodes'] = List.generate(101, (_) => {'type': 'text'});
    expect(() => ShellDocument.fromJson(oversized), throwsFormatException);
    final invalid = document();
    invalid['nodes'] = [
      {'type': 'button', 'id': 'buy', 'action': 'buy'},
    ];
    expect(() => ShellDocument.fromJson(invalid), throwsFormatException);
  });

  test('capabilities list all supported primitives deterministically', () {
    final capabilities = ShellDocument.capabilities;
    expect(capabilities['version'], 1);
    expect(
      capabilities['primitives'],
      containsAll(['metric', 'detail', 'progress']),
    );
    expect(capabilities['maxNodes'], 100);
  });
  test('rejects action documents without timezone-bound expiry', () {
    final missing = document()..remove('expiresAt');
    expect(() => ShellDocument.fromJson(missing), throwsFormatException);
    final local = document()..['expiresAt'] = '2099-01-01T00:00:00';
    expect(() => ShellDocument.fromJson(local), throwsFormatException);
  });
  test('unknown component marks entire document unsupported', () {
    final raw = document();
    raw['nodes'] = [
      {'type': 'future-component', 'text': 'Future'},
    ];
    expect(ShellDocument.fromJson(raw).fullySupported, isFalse);
  });
  test('rejects hidden controls and unsafe options layouts', () {
    final hidden = document();
    hidden['nodes'] = [
      {
        'type': 'text',
        'children': [
          {'type': 'input', 'id': 'hidden'},
        ],
      },
    ];
    expect(() => ShellDocument.fromJson(hidden), throwsFormatException);
    final options = document();
    options['nodes'] = [
      {
        'type': 'options',
        'children': [
          {'type': 'input', 'id': 'wide'},
        ],
      },
    ];
    expect(() => ShellDocument.fromJson(options), throwsFormatException);
  });
  test('rejects deep trees and excessive aggregate text', () {
    dynamic nested = {'type': 'text', 'text': 'leaf'};
    for (var i = 0; i < 8; i++) {
      nested = {
        'type': 'column',
        'children': [nested],
      };
    }
    final deep = document()..['nodes'] = [nested];
    expect(() => ShellDocument.fromJson(deep), throwsFormatException);
    final large = document()
      ..['nodes'] = List.generate(
        8,
        (_) => {'type': 'text', 'text': List.filled(4000, 'a').join()},
      );
    expect(() => ShellDocument.fromJson(large), throwsFormatException);
  });
  test(
    'receipt detail, balance and progress preserve exact display strings',
    () {
      final raw = document()
        ..['nodes'] = [
          {'type': 'metric', 'text': 'Balance', 'value': '0.00001234 BTC'},
          {'type': 'detail', 'text': 'Network', 'value': 'Polygon'},
          {'type': 'progress', 'text': 'Delivering', 'progress': 0.5},
        ];
      final parsed = ShellDocument.fromJson(raw);
      expect(parsed.nodes.first.value, '0.00001234 BTC');
      expect(ShellDocument.fromJson(parsed.toJson()).nodes.last.progress, 0.5);
    },
  );
  test('malformed remote fields keep readable message fallback', () {
    final part = AgentMessagePart.fromJson({
      'kind': 42,
      'title': {},
      'progressCurrent': 'many',
      'document': {'version': 1, 'id': 42, 'fallback': 'Continue in chat.'},
      'file': {'fileId': 'f', 'name': 'f', 'sizeBytes': 'bad'},
    });
    expect(part.body, 'Continue in chat.');
    expect(part.file, isNull);
  });
  testWidgets('unbound actions stay disabled', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShellDocumentView(document: ShellDocument.fromJson(document())),
        ),
      ),
    );
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
  });
  testWidgets('validates input and submits exact opaque action once', (
    tester,
  ) async {
    final actions = <ShellAction>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShellDocumentView(
            document: ShellDocument.fromJson(document()),
            onAction: (action) async {
              actions.add(action);
            },
          ),
        ),
      ),
    );
    await tester.tap(find.text('1 GB'));
    await tester.pump();
    expect(actions, isEmpty);
    await tester.enterText(find.byType(TextFormField), '08012345678');
    await tester.tap(find.text('1 GB'));
    await tester.pumpAndSettle();
    expect(actions.single.documentId, 'quote-1');
    expect(actions.single.revision, 3);
    expect(actions.single.values['phone'], '08012345678');
    await tester.tap(find.text('1 GB'));
    expect(actions.length, 1);
  });

  testWidgets('unknown primitive displays fallback without active controls', (
    tester,
  ) async {
    final raw = document()
      ..['nodes'] = [
        {'type': 'future-widget'},
      ];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShellDocumentView(
            document: ShellDocument.fromJson(raw),
            onAction: (_) async {},
          ),
        ),
      ),
    );
    expect(find.text('Choose a data bundle.'), findsOneWidget);
    expect(find.byType(FilledButton), findsNothing);
  });
  testWidgets('expired options stay disabled', (tester) async {
    final raw = document()..['expiresAt'] = '2000-01-01T00:00:00Z';
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShellDocumentView(
            document: ShellDocument.fromJson(raw),
            onAction: (_) async {},
          ),
        ),
      ),
    );
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    expect(
      find.text('This option has expired. Ask for updated options.'),
      findsOneWidget,
    );
  });
  testWidgets('old request completion cannot consume a newer document', (
    tester,
  ) async {
    final gate = Completer<void>();
    final old = ShellDocument.fromJson(document());
    Future<void> handler(ShellAction _) => gate.future;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShellDocumentView(document: old, onAction: handler),
        ),
      ),
    );
    await tester.enterText(find.byType(TextFormField), '08012345678');
    await tester.tap(find.text('1 GB'));
    await tester.pump();
    final next = document()..['revision'] = 4;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShellDocumentView(
            document: ShellDocument.fromJson(next),
            onAction: handler,
          ),
        ),
      ),
    );
    gate.complete();
    await tester.pumpAndSettle();
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNotNull,
    );
    expect(find.text('Selection submitted.'), findsNothing);
  });
  testWidgets('receipt details fit a narrow screen with large text', (
    tester,
  ) async {
    final raw = document()
      ..['nodes'] = [
        {'type': 'metric', 'text': 'Balance', 'value': '0.00001234 BTC'},
        {
          'type': 'detail',
          'text': 'Transaction reference',
          'value': 'very-long-provider-reference-0123456789',
        },
        {'type': 'progress', 'text': 'Delivering', 'progress': 0.5},
      ];
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: SingleChildScrollView(
              child: SizedBox(
                width: 240,
                child: ShellDocumentView(document: ShellDocument.fromJson(raw)),
              ),
            ),
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
  });
}
