import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Favorites contain opaque Masanawa user IDs only, never device phone numbers.
/// Protected local account-scoped preference; not a contact/consent authority.
abstract interface class ContactHubFavoritesStore {
  Future<Set<String>> load(String ownerId);
  Future<void> save(String ownerId, Set<String> humanUserIds);
  Future<void> clear(String ownerId);
}

class SecureContactHubFavoritesStore implements ContactHubFavoritesStore {
  const SecureContactHubFavoritesStore({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _storage = storage;

  final FlutterSecureStorage _storage;

  String _key(String ownerId) {
    if (ownerId.isEmpty || ownerId.length > 255) {
      throw const FormatException('Invalid authenticated account');
    }
    return 'masanawa:contacts:favorites:v1:${base64Url.encode(utf8.encode(ownerId))}';
  }

  @override
  Future<Set<String>> load(String ownerId) async {
    final raw = await _storage.read(key: _key(ownerId));
    if (raw == null) return <String>{};
    final decoded = jsonDecode(raw);
    if (decoded is! List || decoded.length > 500 ||
        decoded.any((v) => v is! String || v.isEmpty || v.length > 255)) {
      throw const FormatException('Corrupt contact favorites');
    }
    return decoded.cast<String>().toSet();
  }

  @override
  Future<void> save(String ownerId, Set<String> humanUserIds) async {
    if (humanUserIds.length > 500 ||
        humanUserIds.any((v) => v.isEmpty || v.length > 255)) {
      throw const FormatException('Invalid favorite count or identity');
    }
    final sorted = humanUserIds.toList()..sort();
    await _storage.write(key: _key(ownerId), value: jsonEncode(sorted));
  }

  /// Called by account-erasure integration to remove this preference.
  @override
  Future<void> clear(String ownerId) => _storage.delete(key: _key(ownerId));
}
