import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'assistant_workspace_controller.dart';

/// Android Keystore / iOS Keychain storage; intentionally no ordinary
/// SharedPreferences or plaintext files containing conversation drafts.
class SecureAssistantPendingJournal implements AssistantPendingJournal {
  const SecureAssistantPendingJournal({
    FlutterSecureStorage storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    ),
  }) : _storage = storage;

  final FlutterSecureStorage _storage;

  String _key(String ownerId) {
    if (ownerId.isEmpty || ownerId.length > 256 ||
        !RegExp(r'^[a-zA-Z0-9_:.-]+$').hasMatch(ownerId)) {
      throw ArgumentError.value(ownerId, 'ownerId', 'Invalid account identity');
    }
    return 'assistant_pending_v1_' + ownerId;
  }

  @override
  Future<AssistantPendingTurn?> read(String ownerId) async {
    final raw = await _storage.read(key: _key(ownerId));
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw);
      if (json is! Map<String, dynamic>) {
        throw const FormatException('Invalid protected record');
      }
      return AssistantPendingTurn.fromJson(json);
    } on FormatException {
      // Corrupt local state cannot authorize, send or infer completion.
      // Keep it intact for forensic recovery rather than silently duplicating.
      throw StateError('Pending operation cannot be decoded safely');
    }
  }

  @override
  Future<void> write(String ownerId, AssistantPendingTurn turn) =>
      _storage.write(key: _key(ownerId), value: jsonEncode(turn.toJson()));

  @override
  Future<void> clear(String ownerId) => _storage.delete(key: _key(ownerId));
}
