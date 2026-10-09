import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/messages/human_contacts_controller.dart';
import 'package:masanawa/src/messages/human_contacts_transport.dart';

const _prefs = HumanContactPreferences(
  policy: HumanContactPolicy.requests,
  discoverableByHandle: true,
);
const _bob = HumanContact(
  userId: 'user_b',
  handle: 'bob',
  displayName: 'Bob',
  avatarUrl: null,
  status: HumanContactStatus.incoming,
  canMessage: false,
  requestRevision: '1',
);
class _FakeContacts implements HumanContactsTransport {
  Completer<List<HumanContact>>? pendingList;
  Completer<HumanContact?>? pendingLookup;
  Completer<String>? pendingRequest;
  int requests = 0;
  int lookups = 0;
  bool deny = false;
  HumanContactPreferences nextPrefs = _prefs;

  @override
  Future<HumanContactPreferences> preferences() async => nextPrefs;

  @override
  Future<List<HumanContact>> list({int limit = 30}) async =>
      pendingList == null ? [_bob] : pendingList!.future;

  @override
  Future<HumanContact?> lookup(String handle) async {
    lookups++;
    return pendingLookup == null ? _bob : pendingLookup!.future;
  }

  @override
  Future<String> request(String handle) async {
    requests++;
    if (deny) throw const FormatException('Request unavailable');
    return pendingRequest == null ? 'pending' : pendingRequest!.future;
  }

  @override
  Future<String> respond(String userId, {required bool accept, required String requestRevision}) async {
    if (deny) throw const FormatException('Request unavailable');
    return accept ? 'accepted' : 'declined';
  }

  @override
  Future<void> revoke(String userId) async {
    if (deny) throw const FormatException('Request unavailable');
  }

  @override
  Future<HumanContactPreferences> updatePreferences({
    HumanContactPolicy? policy,
    bool? discoverableByHandle,
  }) async {
    if (deny) throw const FormatException('Preference unavailable');
    nextPrefs = HumanContactPreferences(
      policy: policy ?? nextPrefs.policy,
      discoverableByHandle:
          discoverableByHandle ?? nextPrefs.discoverableByHandle,
    );
    return nextPrefs;
  }
}

class _PagedContacts extends _FakeContacts
    implements HumanContactsPaginationTransport {
  Completer<HumanContactPage>? delayedSecond;
  int calls = 0;

  @override
  Future<HumanContactPage> page({int limit = 50, String? cursor}) async {
    calls++;
    if (cursor == null) {
      return const HumanContactPage(contacts: [_bob], nextCursor: 'next_page_1');
    }
    if (delayedSecond != null) return delayedSecond!.future;
    return const HumanContactPage(contacts: [
      HumanContact(
        userId: 'user_c', handle: 'cora', displayName: 'Cora',
        avatarUrl: null, status: HumanContactStatus.accepted,
        canMessage: false, requestRevision: '1',
      ),
    ], nextCursor: null);
  }
}

Future<void> _tick() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

void main() {
  test('signed-out controller does not call private Gateway', () async {
    final fake = _FakeContacts();
    final controller = HumanContactsController(
      transport: fake, ownerId: null, isStillOwner: () => false,
    );
    await controller.refresh();
    await controller.findByHandle('bob');
    await controller.request('bob');
    expect(fake.requests, 0);
    expect(controller.state.contacts, isEmpty);
    expect(controller.state.loading, isFalse);
    controller.dispose();
  });

  test('server preferences and incoming contacts appear after loading', () async {
    final controller = HumanContactsController(
      transport: _FakeContacts(),
      ownerId: 'user_a',
      isStillOwner: () => true,
    );
    await _tick();
    expect(controller.state.loading, isFalse);
    expect(controller.state.contacts.single.userId, 'user_b');
    expect(controller.state.preferences?.policy, HumanContactPolicy.requests);
    await controller.updateDiscoverable(false);
    expect(controller.state.preferences?.discoverableByHandle, isFalse);
    expect(controller.state.notice, 'Handle visibility saved.');
    controller.dispose();
  });

  test('account switch discards an in-flight contact list', () async {
    final fake = _FakeContacts();
    fake.pendingList = Completer<List<HumanContact>>();
    var currentOwner = 'user_a';
    final controller = HumanContactsController(
      transport: fake,
      ownerId: 'user_a',
      isStillOwner: () => currentOwner == 'user_a',
    );
    await _tick();
    currentOwner = 'user_b';
    fake.pendingList!.complete([_bob]);
    await _tick();
    expect(controller.state.contacts, isEmpty);
    await controller.request('bob');
    expect(fake.requests, 0);
    controller.dispose();
  });

  test('out-of-order lookup is never shown after clearing search', () async {
    final fake = _FakeContacts();
    fake.pendingLookup = Completer<HumanContact?>();
    final controller = HumanContactsController(
      transport: fake, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    final first = controller.findByHandle('bob');
    await controller.findByHandle('');
    fake.pendingLookup!.complete(_bob);
    await first;
    expect(controller.state.lookup, isNull);
    expect(controller.state.searching, isFalse);
    controller.dispose();
  });

  test('failed request cannot show success or change contact consent', () async {
    final fake = _FakeContacts()..deny = true;
    final controller = HumanContactsController(
      transport: fake, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    await controller.request('bob');
    expect(controller.state.busy, isFalse);
    expect(controller.state.notice, isNull);
    expect(controller.state.error, 'Request unavailable');
    expect(fake.requests, 1);
    controller.dispose();
  });

  test('request ack is shown only after real server ack, then refreshes', () async {
    final fake = _FakeContacts();
    final controller = HumanContactsController(
      transport: fake, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    await controller.request('bob');
    expect(controller.state.notice, 'Contact request sent.');
    expect(fake.requests, 1);
    expect(controller.state.contacts.single.handle, 'bob');
    controller.dispose();
  });

  test('paginated contacts append distinct people and end at final server page', () async {
    final source = _PagedContacts();
    final controller = HumanContactsController(
      transport: source, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    expect(controller.state.contacts.single.userId, 'user_b');
    expect(controller.state.nextCursor, 'next_page_1');
    await controller.loadMore();
    expect(controller.state.contacts.map((person) => person.userId),
        ['user_b', 'user_c']);
    expect(controller.state.nextCursor, isNull);
    await controller.loadMore();
    expect(source.calls, 2);
    controller.dispose();
  });

  test('late page from previous account is never appended after a switch', () async {
    final source = _PagedContacts()
      ..delayedSecond = Completer<HumanContactPage>();
    var owner = 'user_a';
    final controller = HumanContactsController(
      transport: source, ownerId: 'user_a',
      isStillOwner: () => owner == 'user_a',
    );
    await _tick();
    final running = controller.loadMore();
    await _tick();
    owner = 'user_b';
    source.delayedSecond!.complete(const HumanContactPage(contacts: [
      HumanContact(
        userId: 'user_secret', handle: 'secret', displayName: 'Secret',
        avatarUrl: null, status: HumanContactStatus.accepted,
        canMessage: false, requestRevision: '1',
      ),
    ], nextCursor: null));
    await running;
    expect(controller.state.contacts.map((person) => person.userId),
        isNot(contains('user_secret')));
    controller.dispose();
  });

  test('a paginated network failure keeps retry cursor and never fabricates people', () async {
    final source = _PagedContacts()
      ..delayedSecond = Completer<HumanContactPage>();
    final controller = HumanContactsController(
      transport: source, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    final running = controller.loadMore();
    source.delayedSecond!.completeError(const FormatException('Bad contact page'));
    await running;
    expect(controller.state.error, 'Bad contact page');
    expect(controller.state.contacts.map((person) => person.userId), ['user_b']);
    expect(controller.state.nextCursor, 'next_page_1');
    expect(controller.state.loadingMore, isFalse);
    controller.dispose();
  });

  test('stale initial refresh cannot undo a confirmed privacy preference', () async {
    final fake = _FakeContacts();
    final oldList = Completer<List<HumanContact>>();
    fake.pendingList = oldList;
    final controller = HumanContactsController(
      transport: fake, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    expect(controller.state.loading, isTrue);

    // A refresh started with old preferences and an outstanding contacts list.
    fake.pendingList = null; // The next server read can complete normally.
    await controller.updateDiscoverable(false);
    expect(controller.state.preferences?.discoverableByHandle, isFalse);
    expect(controller.state.loading, isFalse);

    oldList.complete([_bob]);
    await _tick();
    expect(controller.state.preferences?.discoverableByHandle, isFalse);
    expect(controller.state.contacts, isEmpty);
    expect(controller.state.notice, 'Handle visibility saved.');
    controller.dispose();
  });

  test('mutation fences an older contact lookup before permission changes', () async {
    final fake = _FakeContacts();
    final oldLookup = Completer<HumanContact?>();
    fake.pendingLookup = oldLookup;
    final controller = HumanContactsController(
      transport: fake, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    final searching = controller.findByHandle('bob');
    await _tick();
    expect(controller.state.searching, isTrue);

    fake.pendingLookup = null;
    await controller.updatePolicy(HumanContactPolicy.nobody);
    expect(controller.state.searching, isFalse);
    expect(controller.state.lookup, isNull);

    oldLookup.complete(_bob);
    await searching;
    expect(controller.state.lookup, isNull);
    expect(controller.state.lookupHandle, isNull);
    expect(controller.state.preferences?.policy, HumanContactPolicy.nobody);
    controller.dispose();
  });

  test('reads are suspended during an uncertain contact write', () async {
    final fake = _FakeContacts()..pendingRequest = Completer<String>();
    final controller = HumanContactsController(
      transport: fake, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    final initial = controller.state.contacts;
    final sending = controller.request('bob');
    await _tick();
    expect(controller.state.busy, isTrue);
    await controller.refresh();
    await controller.findByHandle('bob');
    expect(fake.lookups, 0);
    expect(controller.state.contacts, initial);
    expect(controller.state.lookup, isNull);

    fake.pendingRequest!.complete('pending');
    await sending;
    expect(controller.state.busy, isFalse);
    expect(controller.state.notice, 'Contact request sent.');
    expect(controller.state.contacts.single.userId, 'user_b');
    controller.dispose();
  });

  test('revocation invalidates pre-write paginated contact results', () async {
    final source = _PagedContacts()
      ..delayedSecond = Completer<HumanContactPage>();
    final controller = HumanContactsController(
      transport: source, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _tick();
    final oldPage = controller.loadMore();
    await _tick();
    expect(controller.state.loadingMore, isTrue);
    await controller.revoke('user_b');
    expect(controller.state.loadingMore, isFalse);

    source.delayedSecond!.complete(const HumanContactPage(contacts: [
      HumanContact(
        userId: 'user_secret', handle: 'secret', displayName: 'Stale',
        avatarUrl: null, status: HumanContactStatus.accepted,
        canMessage: false, requestRevision: '1',
      ),
    ], nextCursor: null));
    await oldPage;
    expect(controller.state.contacts.map((c) => c.userId), ['user_b']);
    expect(controller.state.nextCursor, 'next_page_1');
    expect(source.calls, 3); // Initial, in-flight page, post-revoke readback.
    controller.dispose();
  });
}
