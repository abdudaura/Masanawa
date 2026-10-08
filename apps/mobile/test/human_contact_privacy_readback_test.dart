import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/messages/human_contacts_controller.dart';
import 'package:masanawa/src/messages/human_contacts_transport.dart';

const _original = HumanContactPreferences(
  policy: HumanContactPolicy.requests, discoverableByHandle: true,
);
const _pending = HumanContact(
  userId: 'user_b', handle: 'bob', displayName: 'Bob',
  avatarUrl: null, status: HumanContactStatus.incoming,
  canMessage: false, requestRevision: '42',
);

class _Contacts implements HumanContactsTransport {
  HumanContactPreferences saved = _original;
  bool disagreeOnReadback = false;
  bool failListAfterWrite = false;
  bool rejectRevision = false;
  Completer<String>? pendingResponse;
  int writes = 0;
  int reads = 0;

  @override
  Future<HumanContactPreferences> preferences() async =>
      disagreeOnReadback ? _original : saved;

  @override
  Future<HumanContactPreferences> updatePreferences({
    HumanContactPolicy? policy, bool? discoverableByHandle,
  }) async {
    writes++;
    saved = HumanContactPreferences(
      policy: policy ?? saved.policy,
      discoverableByHandle:
          discoverableByHandle ?? saved.discoverableByHandle,
    );
    return saved;
  }

  @override
  Future<List<HumanContact>> list({int limit = 30}) async {
    reads++;
    if (failListAfterWrite && writes > 0) {
      throw const FormatException('Refresh failed');
    }
    return [_pending];
  }

  @override
  Future<String> request(String handle) async {
    writes++;
    return 'pending';
  }

  @override
  Future<String> respond(String requesterId, {
    required bool accept, required String requestRevision,
  }) async {
    writes++;
    if (rejectRevision || requestRevision != '42') {
      throw const FormatException('Request revision expired');
    }
    return pendingResponse?.future ??
        Future<String>.value(accept ? 'accepted' : 'declined');
  }

  @override
  Future<void> revoke(String otherUserId) async {
    writes++;
  }

  @override
  Future<HumanContact?> lookup(String handle) async => _pending;
}

Future<void> _flush() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

void main() {
  test('successful request requires a subsequent live server read', () async {
    final transport = _Contacts();
    final controller = HumanContactsController(
      transport: transport, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _flush();
    final startReads = transport.reads;
    await controller.request('bob');
    expect(transport.writes, 1);
    expect(transport.reads, startReads + 1);
    expect(controller.state.notice, 'Contact request sent.');
    expect(controller.state.busy, isFalse);
    controller.dispose();
  });

  test('readback failure preserves uncertainty rather than a false success',
      () async {
    final transport = _Contacts()..failListAfterWrite = true;
    final controller = HumanContactsController(
      transport: transport, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _flush();
    await controller.respond('user_b', accept: true, requestRevision: '42');
    expect(transport.writes, 1);
    expect(controller.state.notice, isNull);
    expect(controller.state.error, contains('may have changed'));
    expect(controller.state.busy, isFalse);
    controller.dispose();
  });

  test('stale request revision never reports an accepted contact', () async {
    final transport = _Contacts()..rejectRevision = true;
    final controller = HumanContactsController(
      transport: transport, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _flush();
    await controller.respond('user_b', accept: true, requestRevision: '41');
    expect(controller.state.notice, isNull);
    expect(controller.state.error, 'Request revision expired');
    controller.dispose();
  });

  test('privacy preference must match authoritative GET after PATCH',
      () async {
    final transport = _Contacts()..disagreeOnReadback = true;
    final controller = HumanContactsController(
      transport: transport, ownerId: 'user_a', isStillOwner: () => true,
    );
    await _flush();
    await controller.updatePolicy(HumanContactPolicy.nobody);
    expect(transport.writes, 1);
    expect(controller.state.notice, isNull);
    expect(controller.state.error, contains('privacy policy changed'));
    expect(controller.state.preferences?.policy, HumanContactPolicy.requests);
    controller.dispose();
  });

  test('discoverability readback confirms the new server state', () async {
    final controller = HumanContactsController(
      transport: _Contacts(), ownerId: 'user_a', isStillOwner: () => true,
    );
    await _flush();
    await controller.updateDiscoverable(false);
    expect(controller.state.notice, 'Handle visibility saved.');
    expect(controller.state.preferences?.discoverableByHandle, isFalse);
    controller.dispose();
  });

  test('account switch during in-flight accept never publishes a success',
      () async {
    final transport = _Contacts()..pendingResponse = Completer<String>();
    var signedInAs = 'user_a';
    final controller = HumanContactsController(
      transport: transport,
      ownerId: 'user_a',
      isStillOwner: () => signedInAs == 'user_a',
    );
    await _flush();
    final operation = controller.respond(
      'user_b', accept: true, requestRevision: '42',
    );
    await _flush();
    signedInAs = 'user_c';
    transport.pendingResponse!.complete('accepted');
    await operation;
    expect(controller.state.notice, isNull);
    expect(transport.reads, 1);
    controller.dispose();
  });
}
