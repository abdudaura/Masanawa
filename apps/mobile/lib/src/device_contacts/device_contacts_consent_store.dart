import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Only a boolean consent preference is persisted; names/numbers never are.
/// Scoped by the exact authenticated account and inaccessible to ordinary cache.
abstract interface class DeviceContactsConsentStore {
  Future<bool> optedIn(String accountId);
  Future<void> setOptedIn(String accountId, bool enabled);
}

class SecureDeviceContactsConsentStore implements DeviceContactsConsentStore {
  const SecureDeviceContactsConsentStore({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _storage = storage;

  final FlutterSecureStorage _storage;

  String _key(String accountId) =>
      'device_contacts_opt_in_v1:' +
      base64Url.encode(utf8.encode(accountId));

  @override
  Future<bool> optedIn(String accountId) async =>
      (await _storage.read(key: _key(accountId))) == 'true';

  @override
  Future<void> setOptedIn(String accountId, bool enabled) async {
    if (enabled) {
      await _storage.write(key: _key(accountId), value: 'true');
    } else {
      await _storage.delete(key: _key(accountId));
    }
  }
}
