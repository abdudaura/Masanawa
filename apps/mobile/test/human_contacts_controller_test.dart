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
  int requests = 0;
  bool deny = false;
  HumanContactPreferences nextPrefs = _prefs;

  @override
  Future<HumanContactPreferences> preferences() async => nextPrefs;

  @override
  Future<List<HumanContact>> list({int limit = 30}) async =>
      pendingList == null ? [_bob] : pendingList!.future;

  @override
  Future<HumanContact?> lookup(String handle) async =>
      pendingLookup == null ? _bob : pendingLookup!.future;

  @override
  Future<String> request(String handle) async {
    requests++;
    if (deny) throw const FormatException('Request unavailable');
    return 'pending';
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
}

