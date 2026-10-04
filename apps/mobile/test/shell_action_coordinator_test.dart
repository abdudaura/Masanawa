import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:masanawa/src/chat/shell_document.dart';
import 'package:masanawa/src/chat/shell_action_coordinator.dart';

class Journal implements ShellActionJournal {
  final records = <String, ShellActionRecord>{};
  bool failCreate = false;
  bool failComplete = false;
  @override
  Future<bool> createPending(String key, ShellAction action) async {
    if (failCreate) throw StateError('storage unavailable');
    if (records.containsKey(key)) return false;
    records[key] = ShellActionRecord(
      action: action,
      state: ShellActionState.pending,
    );
    return true;
  }

  @override
  Future<ShellActionRecord?> read(String key) async => records[key];
  @override
  Future<void> complete(String key) async {
    if (failComplete) throw StateError('storage unavailable');
    final existing = records[key]!;
    records[key] = ShellActionRecord(
      action: existing.action,
      state: ShellActionState.completed,
    );
  }
}

class Dispatcher implements ShellActionDispatcher {
  int sends = 0;
  int queries = 0;
  bool fail = false;
  bool confirmed = false;
  Completer<void>? gate;
  @override
  Future<void> dispatch(ShellAction action) async {
    sends++;
    if (gate != null) await gate!.future;
    if (fail) throw StateError('timeout');
    confirmed = true;
  }

  @override
  Future<bool> accepted(ShellAction action) async {
    queries++;
    return confirmed;
  }
}

ShellAction action({String node = 'small', String value = '08012345678'}) =>
    ShellAction(
      documentId: 'quote',
      revision: 1,
      nodeId: node,
      actionId: 'choose',
      token: 'opaque-$node',
      values: {'phone': value},
    );

void main() {
  test(
    'completed selection survives coordinator restart without redispatch',
    () async {
      final journal = Journal();
      final dispatcher = Dispatcher();
      await ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      ).submit(action());
      await ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      ).submit(action());
      expect(dispatcher.sends, 1);
    },
  );
  test(
    'timeout retains pending; retry only queries authoritative status',
    () async {
      final journal = Journal();
      final dispatcher = Dispatcher()..fail = true;
      final first = ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      );
      await expectLater(
        first.submit(action()),
        throwsA(isA<ShellActionUncertain>()),
      );
      final restarted = ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      );
      await expectLater(
        restarted.submit(action()),
        throwsA(isA<ShellActionUncertain>()),
      );
      expect(dispatcher.sends, 1);
      expect(dispatcher.queries, 1);
      dispatcher.confirmed = true;
      await restarted.submit(action());
      expect(journal.records.values.single.state, ShellActionState.completed);
      expect(dispatcher.sends, 1);
    },
  );
  test(
    'changed values or another option require new server document revision',
    () async {
      final journal = Journal();
      final dispatcher = Dispatcher();
      final coordinator = ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      );
      await coordinator.submit(action());
      await expectLater(
        coordinator.submit(action(value: '08100000000')),
        throwsA(isA<ShellActionConflict>()),
      );
      await expectLater(
        coordinator.submit(action(node: 'large')),
        throwsA(isA<ShellActionConflict>()),
      );
      expect(dispatcher.sends, 1);
    },
  );
  test('journal failure prevents dispatch', () async {
    final journal = Journal()..failCreate = true;
    final dispatcher = Dispatcher();
    await expectLater(
      ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      ).submit(action()),
      throwsStateError,
    );
    expect(dispatcher.sends, 0);
  });
  test('completion write failure reconciles without resending', () async {
    final journal = Journal()..failComplete = true;
    final dispatcher = Dispatcher();
    final coordinator = ShellActionCoordinator(
      scope: 'user/session',
      journal: journal,
      dispatcher: dispatcher,
    );
    await expectLater(
      coordinator.submit(action()),
      throwsA(isA<ShellActionUncertain>()),
    );
    journal.failComplete = false;
    await coordinator.submit(action());
    expect(dispatcher.sends, 1);
    expect(dispatcher.queries, 1);
  });
  test(
    'atomic claim prevents different selections racing between coordinators',
    () async {
      final journal = Journal();
      final dispatcher = Dispatcher()..gate = Completer<void>();
      final a = ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      );
      final b = ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      );
      final pending = a.submit(action());
      await Future<void>.delayed(Duration.zero);
      await expectLater(
        b.submit(action(node: 'large')),
        throwsA(isA<ShellActionConflict>()),
      );
      dispatcher.gate!.complete();
      await pending;
      expect(dispatcher.sends, 1);
    },
  );
  test(
    'same pending selection cannot dispatch twice while in flight',
    () async {
      final journal = Journal();
      final dispatcher = Dispatcher()..gate = Completer<void>();
      final coordinator = ShellActionCoordinator(
        scope: 'user/session',
        journal: journal,
        dispatcher: dispatcher,
      );
      final pending = coordinator.submit(action());
      await expectLater(
        coordinator.submit(action()),
        throwsA(isA<ShellActionUncertain>()),
      );
      dispatcher.gate!.complete();
      await pending;
      expect(dispatcher.sends, 1);
    },
  );
  test(
    'user/session namespace isolates matching document identifiers',
    () async {
      final journal = Journal();
      final dispatcher = Dispatcher();
      await ShellActionCoordinator(
        scope: 'user-a/session',
        journal: journal,
        dispatcher: dispatcher,
      ).submit(action());
      await ShellActionCoordinator(
        scope: 'user-b/session',
        journal: journal,
        dispatcher: dispatcher,
      ).submit(action());
      expect(journal.records.length, 2);
    },
  );
}
