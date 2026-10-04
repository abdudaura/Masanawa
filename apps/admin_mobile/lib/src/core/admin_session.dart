import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AdminSession {
  AdminSession({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _tokenKey = 'masanawa_admin_operator_token';
  final FlutterSecureStorage _storage;

  Future<String?> restore() async {
    final value = await _storage.read(key: _tokenKey);
    if (value == null || value.trim().isEmpty) return null;
    return value.trim();
  }

  Future<void> save(String token) =>
      _storage.write(key: _tokenKey, value: token.trim());

  Future<void> clear() => _storage.delete(key: _tokenKey);
}
