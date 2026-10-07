import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AdminStoredSession {
  const AdminStoredSession({
    required this.accessToken,
    required this.refreshToken,
  });

  final String accessToken;
  final String refreshToken;
}

class AdminSession {
  AdminSession({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _accessTokenKey = 'masanawa_admin_access_token';
  static const _refreshTokenKey = 'masanawa_admin_refresh_token';
  final FlutterSecureStorage _storage;

  Future<AdminStoredSession?> restore() async {
    final access = (await _storage.read(key: _accessTokenKey))?.trim();
    final refresh = (await _storage.read(key: _refreshTokenKey))?.trim();
    if (access == null ||
        access.isEmpty ||
        refresh == null ||
        refresh.isEmpty) {
      return null;
    }
    return AdminStoredSession(accessToken: access, refreshToken: refresh);
  }

  Future<void> save({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(
      key: _accessTokenKey,
      value: accessToken.trim(),
    );
    await _storage.write(
      key: _refreshTokenKey,
      value: refreshToken.trim(),
    );
  }

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
