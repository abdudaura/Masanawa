import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/device_contacts/device_contacts_controller.dart';
import 'package:masanawa/src/device_contacts/device_contacts_consent_store.dart';
import 'package:masanawa/src/device_contacts/device_contacts_model.dart';

class TestPlatform implements DeviceContactsPlatform {
  DeviceContactsPermission permission = DeviceContactsPermission.denied;
  DeviceContactsPermission permissionAfterRequest = DeviceContactsPermission.granted;
  List<DevicePhoneContact> rows = const [];
  Completer<List<DevicePhoneContact>>? pending;
  int reads = 0, requests = 0, settings = 0;

  @override
  Future<DeviceContactsPermission> checkPermission() async => permission;
  @override
  Future<DeviceContactsPermission> requestPermission() async {
    requests++;
    permission = permissionAfterRequest;
    return permission;
  }
  @override
  Future<List<DevicePhoneContact>> readContacts() {
    reads++;
    return pending?.future ?? Future.value(rows);
  }
  @override
  Future<void> openPermissionSettings() async { settings++; }
}

class TestInvite implements DeviceContactsInvite {
  int shares = 0;
  @override
  Future<void> sharePublicInvite() async { shares++; }
}

class TestConsentStore implements DeviceContactsConsentStore {
  final Map<String, bool> saved = {};
  bool failWrites = false;
  @override
  Future<bool> optedIn(String accountId) async => saved[accountId] ?? false;
  @override
  Future<void> setOptedIn(String accountId, bool enabled) async {
    if (failWrites) throw StateError('simulated secure store failure');
    if (enabled) { saved[accountId] = true; } else { saved.remove(accountId); }
  }
}

const one = DevicePhoneContact(
  deviceId: 'one', name: 'Maryam 🌻',
  numbers: ['+234 801 222 3344', '+234-801-222-3344', '08012223344'],
);
const two = DevicePhoneContact(deviceId: 'two', name: 'أحمد',
  numbers: ['080 3456 9876', '+49 (111) 222333']);

void main() {
  test('local-only normalization deduplicates, never invents E.164', () {
    expect(localNumberKey('+234 801 222 3344'), '+2348012223344');
    expect(localNumberKey('0801 222 3344'), '0801 222 3344');
    final result = sanitizePhonebook([one, one, two,
      const DevicePhoneContact(deviceId:'empty', name:'Blank', numbers:[])]);
    expect(result.length, 2);
    expect(result.singleWhere((r) => r.deviceId == 'one').numbers.length, 2);
    expect(result.any((r) => r.name == 'أحمد'), isTrue);
    expect(result.any((r) => r.deviceId == 'empty'), isFalse);
  });

  test('no read before explicit consent, denied keeps contacts empty', () async {
    final os = TestPlatform()..permissionAfterRequest = DeviceContactsPermission.denied;
    final model = DeviceContactsController(
      platform: os, invite: TestInvite(), accountId: 'a');
    await model.refresh();
    expect(os.requests, 0);
    expect(os.reads, 0);
    await model.enable();
    expect(os.requests, 1);
    expect(os.reads, 0);
    expect(model.contacts, isEmpty);
    model.dispose();
  });

  test('permission grant reads only after opt-in, supports limited access', () async {
    final os = TestPlatform()..rows = [one, two]
      ..permissionAfterRequest = DeviceContactsPermission.limited;
    final model = DeviceContactsController(
      platform: os, invite: TestInvite(), accountId: 'a');
    await model.enable();
    expect(model.permission, DeviceContactsPermission.limited);
    expect(model.contacts.length, 2);
    model.setSearch('MARYAM');
    expect(model.visible.length, 1);
    expect(model.visible.single.deviceId, 'one');
    model.dispose();
  });

  test('permission revoked on resume wipes old local records', () async {
    final os = TestPlatform()..permission = DeviceContactsPermission.granted
      ..rows = [one];
    final model = DeviceContactsController(
      platform: os, invite: TestInvite(), accountId: 'a');
    await model.enable();
    expect(model.contacts.length, 1);
    os.permission = DeviceContactsPermission.permanentlyDenied;
    await model.refresh();
    expect(model.contacts, isEmpty);
    expect(model.canRead, isFalse);
    expect(model.needsSettings, isTrue);
    await model.openSettings();
    expect(os.settings, 1);
    model.dispose();
  });

  test('revocation and account switch fence late native completions', () async {
    final os = TestPlatform()..permission = DeviceContactsPermission.granted
      ..pending = Completer<List<DevicePhoneContact>>();
    final model = DeviceContactsController(
      platform: os, invite: TestInvite(), accountId: 'a');
    final inflight = model.enable();
    await Future<void>.delayed(Duration.zero);
    model.accountChanged('b');
    os.pending!.complete([one]);
    await inflight;
    expect(model.optedIn, isFalse);
    expect(model.contacts, isEmpty);
    expect(model.isSignedIn, isTrue);
    expect(model.permission, DeviceContactsPermission.unknown);
    model.dispose();
  });

  test('user can revoke before permission IO completes', () async {
    final os = TestPlatform()..permission = DeviceContactsPermission.granted
      ..pending = Completer<List<DevicePhoneContact>>();
    final model = DeviceContactsController(
      platform: os, invite: TestInvite(), accountId: 'a');
    final inflight = model.enable();
    await Future<void>.delayed(Duration.zero);
    model.disable();
    os.pending!.complete([two]);
    await inflight;
    expect(model.contacts, isEmpty);
    expect(model.canRead, isFalse);
    model.dispose();
  });

  test('invite only selected local contact; never calls share on bad ID', () async {
    final os = TestPlatform()..permission = DeviceContactsPermission.granted
      ..rows = [one];
    final sharer = TestInvite();
    final model = DeviceContactsController(
      platform: os, invite: sharer, accountId: 'a');
    await model.enable();
    await model.invite('missing', 0);
    await model.invite('one', 50);
    expect(sharer.shares, 0);
    await model.invite('one', 1);
    expect(sharer.shares, 1);
    model.disable();
    await model.invite('one', 0);
    expect(sharer.shares, 1);
    model.dispose();
  });

  test('ten thousand entries are sorted without a UI widget per contact', () {
    final items = List.generate(10000, (i) => DevicePhoneContact(
      deviceId: i.toString(), name: 'User ' + i.toString(),
      numbers: ['+2348000000000']));
    final clean = sanitizePhonebook(items);
    expect(clean.length, 10000);
    expect(clean.first.name, 'User 0');
  });
  test('persisted opt-in is account-specific and never auto-reads phonebook', () async {
    final os = TestPlatform()..permission = DeviceContactsPermission.granted
      ..rows = [one];
    final store = TestConsentStore()..saved['a'] = true;
    final model = DeviceContactsController(
      platform: os, invite: TestInvite(), accountId: 'a', consentStore: store);
    await model.restoreConsent();
    expect(model.rememberedConsent, isTrue);
    expect(model.optedIn, isFalse);
    expect(os.reads, 0);
    await model.enable();
    expect(os.reads, 1);
    await model.disable();
    expect(store.saved['a'], isNull);
    expect(model.contacts, isEmpty);
    model.accountChanged('b');
    await model.restoreConsent();
    expect(model.rememberedConsent, isFalse);
    model.dispose();
  });

  test('secure consent write failure fails closed without OS permission', () async {
    final os = TestPlatform()..permission = DeviceContactsPermission.granted;
    final store = TestConsentStore()..failWrites = true;
    final model = DeviceContactsController(
      platform: os, invite: TestInvite(), accountId: 'a', consentStore: store);
    await model.enable();
    expect(model.optedIn, isFalse);
    expect(os.reads, 0);
    expect(model.error, contains('securely'));
    model.dispose();
  });

}
