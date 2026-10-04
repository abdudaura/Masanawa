import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/chat/shell_document.dart';
import 'package:masanawa/src/chat/shell_document_view.dart';
import 'package:masanawa/src/chat/message_parts.dart';

Map<String, dynamic> document({int version = 1}) => {
  'version': version, 'id': 'quote-1', 'revision': 3,
  'fallback': 'Choose a data bundle.',
  'nodes': [
    {'type': 'input', 'id': 'phone', 'text': 'Phone', 'required': true},
    {'type': 'options', 'children': [
      {'type': 'button', 'id': 'buy', 'text': '1 GB',
        'action': 'choose-bundle', 'token': 'server-issued-token'}
    ]}
  ]
};

void main() {
  test('documents round trip without losing action scope', () {
    final parsed = ShellDocument.fromJson(document());
    expect(ShellDocument.fromJson(parsed.toJson()).revision, 3);
    expect(parsed.nodes.last.children.single.token, 'server-issued-token');
  });
  test('unsupported version retains readable part fallback', () {
    final part = AgentMessagePart.fromJson({
      'kind': 'future-kind', 'document': document(version: 99),
    });
    expect(part.document, isNull);
    expect(part.body, 'Choose a data bundle.');
  });
  test('rejects duplicate ids, excessive trees and tokenless actions', () {
    final duplicate = document();
    duplicate['nodes'] = [
      {'type': 'text', 'id': 'same'}, {'type': 'text', 'id': 'same'}
    ];
    expect(() => ShellDocument.fromJson(duplicate), throwsFormatException);
    final oversized = document();
    oversized['nodes'] = List.generate(101, (_) => {'type': 'text'});
    expect(() => ShellDocument.fromJson(oversized), throwsFormatException);
    final invalid = document();
    invalid['nodes'] = [{'type': 'button', 'id': 'buy', 'action': 'buy'}];
    expect(() => ShellDocument.fromJson(invalid), throwsFormatException);
  });
  testWidgets('unbound actions stay disabled', (tester) async {
    await tester.pumpWidget(MaterialApp(home: Scaffold(body:
      ShellDocumentView(document: ShellDocument.fromJson(document())))));
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
  });
  testWidgets('validates input and submits exact opaque action once', (tester) async {
    final actions = <ShellAction>[];
    await tester.pumpWidget(MaterialApp(home: Scaffold(body:
      ShellDocumentView(document: ShellDocument.fromJson(document()),
        onAction: (action) async { actions.add(action); }))));
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
}
