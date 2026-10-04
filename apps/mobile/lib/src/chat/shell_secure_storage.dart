import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'shell_action_journal.dart';

/// Uses the app's existing native secure-storage plugin; no preferences or
/// plaintext file fallback is permitted when encrypted storage is unavailable.
class FlutterShellEncryptedStore implements ShellEncryptedStore {
  const FlutterShellEncryptedStore({
    this.storage = const FlutterSecureStorage(),
  });
  final FlutterSecureStorage storage;
  @override
  Future<String?> read(String key) => storage.read(key: key);
  @override
  Future<void> write(String key, String value) =>
      storage.write(key: key, value: value);
  @override
  Future<void> delete(String key) => storage.delete(key: key);
}
