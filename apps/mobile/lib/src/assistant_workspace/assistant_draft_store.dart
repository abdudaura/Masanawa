import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Plaintext drafts must not be written to preferences or application files.
abstract class AssistantDraftStore {
  Future<String?> read(String accountId);
  Future<void> write(String accountId, String text);
  Future<void> clear(String accountId);
}

/// Drafts belong to the signed-in account, not the current support persona.
class SecureAssistantDraftStore implements AssistantDraftStore {
  const SecureAssistantDraftStore({
    FlutterSecureStorage storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    ),
  }) : _storage = storage;

  final FlutterSecureStorage _storage;

  String _key(String accountId) {
    if (!RegExp(r'^[a-zA-Z0-9_.:-]{3,256}$').hasMatch(accountId)) {
      throw const FormatException('Invalid account identifier');
    }
    return 'assistant_draft_v1_' + accountId;
  }

  @override
  Future<String?> read(String accountId) async {
    final value = await _storage.read(key: _key(accountId));
    if (value == null) return null;
    if (value.length > 6000) {
      throw const FormatException('Invalid protected assistant draft');
    }
    return value;
  }

  @override
  Future<void> write(String accountId, String text) async {
    if (text.length > 6000) throw const FormatException('Draft is too long');
    if (text.isEmpty) {
      await clear(accountId);
      return;
    }
    await _storage.write(key: _key(accountId), value: text);
  }

  @override
  Future<void> clear(String accountId) =>
      _storage.delete(key: _key(accountId));
}

