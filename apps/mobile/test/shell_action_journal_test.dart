import 'package:flutter_test/flutter_test.dart';

import 'package:masanawa/src/chat/shell_action_journal.dart';
import 'package:masanawa/src/chat/shell_document.dart';
import 'package:masanawa/src/chat/shell_action_coordinator.dart';

class Store implements ShellEncryptedStore {
  final data = <String, String>{};
  bool fail = false;
  @override
  Future<String?> read(String key) async => data[key];
  @override
  Future<void> write(String key, String value) async {
    if (fail) throw StateError('secure storage unavailable');
    data[key] = value;
  }

  @override
  Future<void> delete(String key) async => data.remove(key);
}

const action = ShellAction(
  documentId: 'quote',
  revision: 1,
  nodeId: 'small',
  actionId: 'choose',
  token: 'opaque',
  values: {'phone': '08012345678'},
);
void main() {
  test(
    'pending survives new journal instance and completion preserves terms',
    () async {
      final store = Store();
      final first = EncryptedShellActionJournal(store: store, namespace: 'a');
      expect(await first.createPending('key', action), isTrue);
      final next = EncryptedShellActionJournal(store: store, namespace: 'a');
      expect((await next.read('key'))!.state, ShellActionState.pending);
      await next.complete('key');
      await next.complete('key');
      final restored = await first.read('key');
      expect(restored!.state, ShellActionState.completed);
      expect(restored.action.token, 'opaque');
      expect(restored.action.values, action.values);
    },
  );
  test('two widgets atomically claim one encrypted record', () async {
    final store = Store();
    final a = EncryptedShellActionJournal(store: store, namespace: 'b');
    final b = EncryptedShellActionJournal(store: store, namespace: 'b');
    final results = await Future.wait([
      a.createPending('key', action),
      b.createPending('key', action),
    ]);
    expect(results.where((r) => r).length, 1);
  });
  test('storage errors do not create a successful pending claim', () async {
    final store = Store()..fail = true;
    final journal = EncryptedShellActionJournal(store: store, namespace: 'c');
    await expectLater(journal.createPending('key', action), throwsStateError);
    expect(await journal.read('key'), isNull);
    store.fail = false;
    expect(await journal.createPending('key', action), isTrue);
  });
  test(
    'corrupt storage fails closed instead of treating records as absent',
    () async {
      final store = Store()..data['masanawa.shell.actions.v1:d'] = '{bad';
      final journal = EncryptedShellActionJournal(store: store, namespace: 'd');
      await expectLater(journal.read('key'), throwsFormatException);
      await expectLater(
        journal.createPending('key', action),
        throwsFormatException,
      );
    },
  );
  test(
    'bounded journal keeps pending history and refuses silent eviction',
    () async {
      final journal = EncryptedShellActionJournal(
        store: Store(),
        namespace: 'e',
      );
      for (var i = 0; i < 128; i++) {
        await journal.createPending('key-$i', action);
      }
      await expectLater(
        journal.createPending('overflow', action),
        throwsStateError,
      );
      expect((await journal.read('key-0'))!.state, ShellActionState.pending);
    },
  );
  test('logout deletes scoped records and closes the journal', () async {
    final store = Store();
    final journal = EncryptedShellActionJournal(store: store, namespace: 'f');
    final other = EncryptedShellActionJournal(store: store, namespace: 'f');
    await journal.createPending('key', action);
    await journal.clearAndClose();
    expect(store.data, isEmpty);
    await expectLater(journal.read('key'), throwsStateError);
    await expectLater(other.createPending('key', action), throwsStateError);
    final newLogin = EncryptedShellActionJournal(store: store, namespace: 'f');
    expect(await newLogin.read('key'), isNull);
  });
}
