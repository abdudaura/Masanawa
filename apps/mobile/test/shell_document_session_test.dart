import 'package:flutter_test/flutter_test.dart';

import 'package:masanawa/src/chat/shell_document.dart';
import 'package:masanawa/src/chat/shell_document_session.dart';

ShellDocument document({int revision = 1, String second = 'Large'}) =>
    ShellDocument.fromJson({
      'version': 1,
      'id': 'quote',
      'revision': revision,
      'fallback': 'Choose a bundle',
      'expiresAt': '2099-01-01T00:00:00Z',
      'nodes': [
        {'type': 'input', 'id': 'phone', 'required': true},
        {
          'type': 'options',
          'children': [
            {
              'type': 'button',
              'id': 'small',
              'text': 'Small',
              'action': 'choose',
              'token': 's',
            },
            {
              'type': 'button',
              'id': 'large',
              'text': second,
              'action': 'choose',
              'token': 'l',
            },
          ],
        },
      ],
    });
ShellDocumentUpdate update({
  int revision = 1,
  int? expected,
  ShellDocumentPhase phase = ShellDocumentPhase.choosing,
  String scope = 'user/session',
  String second = 'Large',
}) => ShellDocumentUpdate(
  scope: scope,
  document: document(revision: revision, second: second),
  phase: phase,
  expectedRevision: expected,
);

void main() {
  test(
    'only accepted revisions notify the live view and close clears state',
    () async {
      final session = ShellDocumentSession('user/session');
      var notifications = 0;
      final subscription = session.changes.listen((_) => notifications++);
      session.apply(update());
      session.apply(update());
      session.apply(update(revision: 2, expected: 1));
      expect(notifications, 2);
      session.clear();
      expect(notifications, 3);
      await session.close();
      expect(session.snapshots, isEmpty);
      expect(() => session.apply(update()), throwsStateError);
      await subscription.cancel();
    },
  );
  test('processing cannot regress to submitted or reopen a failed intent', () {
    final session = ShellDocumentSession('user/session')..apply(update());
    session.apply(
      update(revision: 2, expected: 1, phase: ShellDocumentPhase.processing),
    );
    expect(
      () => session.apply(
        update(revision: 3, expected: 2, phase: ShellDocumentPhase.submitted),
      ),
      throwsA(isA<ShellDocumentConflict>()),
    );
    session.apply(
      update(revision: 3, expected: 2, phase: ShellDocumentPhase.failed),
    );
    expect(
      () => session.apply(
        update(revision: 4, expected: 3, phase: ShellDocumentPhase.processing),
      ),
      throwsA(isA<ShellDocumentConflict>()),
    );
  });
  test(
    'exact replay and stale updates cannot replace current presentation',
    () {
      final session = ShellDocumentSession('user/session');
      expect(session.apply(update()), isTrue);
      expect(session.apply(update()), isFalse);
      expect(session.apply(update(revision: 2, expected: 1)), isTrue);
      expect(session.apply(update()), isFalse);
      expect(session.read('quote')!.document.revision, 2);
    },
  );
  test('same revision changed content and wrong revision predecessor fail', () {
    final session = ShellDocumentSession('user/session')..apply(update());
    expect(
      () => session.apply(update(second: 'Changed')),
      throwsA(isA<ShellDocumentConflict>()),
    );
    expect(
      () => session.apply(update(revision: 2, expected: 0)),
      throwsA(isA<ShellDocumentConflict>()),
    );
  });
  test('foreign session update fails without modifying current content', () {
    final session = ShellDocumentSession('user/session');
    expect(
      () => session.apply(update(scope: 'other/session')),
      throwsA(isA<ShellDocumentConflict>()),
    );
    expect(session.snapshots, isEmpty);
  });
  test('selection and typed label resolve the same exact server action', () {
    final session = ShellDocumentSession('user/session')..apply(update());
    final ordinal = session.select(
      documentId: 'quote',
      revision: 1,
      ordinal: 2,
      values: {'phone': '08012345678'},
    );
    final label = session.select(
      documentId: 'quote',
      revision: 1,
      label: ' large ',
      values: {'phone': '08012345678'},
    );
    expect(ordinal.nodeId, label.nodeId);
    expect(ordinal.token, label.token);
  });
  test('ambiguous labels, missing values and injected fields fail closed', () {
    final session = ShellDocumentSession('user/session')
      ..apply(update(second: 'Small'));
    expect(
      () => session.select(
        documentId: 'quote',
        revision: 1,
        label: 'Small',
        values: {'phone': '08012345678'},
      ),
      throwsA(isA<ShellChoiceUnavailable>()),
    );
    expect(
      () => session.select(documentId: 'quote', revision: 1, ordinal: 1),
      throwsA(isA<ShellChoiceUnavailable>()),
    );
    expect(
      () => session.select(
        documentId: 'quote',
        revision: 1,
        ordinal: 1,
        values: {'phone': '08012345678', 'price': '0'},
      ),
      throwsA(isA<ShellChoiceUnavailable>()),
    );
  });
  test(
    'submitted state is distinct from fulfillment and cannot be selected',
    () {
      final session = ShellDocumentSession('user/session')..apply(update());
      session.apply(
        update(revision: 2, expected: 1, phase: ShellDocumentPhase.submitted),
      );
      expect(session.read('quote')!.phase, ShellDocumentPhase.submitted);
      expect(
        () => session.select(
          documentId: 'quote',
          revision: 2,
          ordinal: 1,
          values: {'phone': '08012345678'},
        ),
        throwsA(isA<ShellChoiceUnavailable>()),
      );
      expect(
        () => session.apply(update(revision: 3, expected: 2)),
        throwsA(isA<ShellDocumentConflict>()),
      );
    },
  );
  test('terminal fulfillment cannot be overwritten by delayed processing', () {
    final session = ShellDocumentSession('user/session')..apply(update());
    session.apply(
      update(revision: 2, expected: 1, phase: ShellDocumentPhase.fulfilled),
    );
    expect(
      () => session.apply(
        update(revision: 3, expected: 2, phase: ShellDocumentPhase.processing),
      ),
      throwsA(isA<ShellDocumentConflict>()),
    );
  });
  test(
    'stale revision, invalid ordinal and simultaneous selectors are rejected',
    () {
      final session = ShellDocumentSession('user/session')..apply(update());
      for (final ordinal in [0, 3]) {
        expect(
          () => session.select(
            documentId: 'quote',
            revision: 1,
            ordinal: ordinal,
            values: {'phone': '08012345678'},
          ),
          throwsA(isA<ShellChoiceUnavailable>()),
        );
      }
      expect(
        () => session.select(
          documentId: 'quote',
          revision: 0,
          ordinal: 1,
          values: {'phone': '08012345678'},
        ),
        throwsA(isA<ShellChoiceUnavailable>()),
      );
      expect(
        () => session.select(
          documentId: 'quote',
          revision: 1,
          ordinal: 1,
          label: 'Small',
          values: {'phone': '08012345678'},
        ),
        throwsA(isA<ShellChoiceUnavailable>()),
      );
      session.clear();
      expect(session.snapshots, isEmpty);
    },
  );
}
