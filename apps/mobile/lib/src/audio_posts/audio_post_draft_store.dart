import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// A publish attempt is saved BEFORE contacting the server. Retrying with the
/// same request ID must never create a second Talk after an uncertain timeout.
class PendingTalkPublish {
  const PendingTalkPublish({
    required this.accountId, required this.requestId, required this.assetId,
    required this.durationMs, required this.title,
  });

  final String accountId;
  final String requestId;
  final String assetId;
  final int durationMs;
  final String title;

  bool get isValid => accountId.trim().isNotEmpty &&
      RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$').hasMatch(requestId) &&
      RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$').hasMatch(assetId) &&
      durationMs >= 1000 && durationMs <= 180000 &&
      title.trim() == title && title.isNotEmpty && title.length <= 100 &&
      !RegExp(r'[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]').hasMatch(title);

  Map<String, Object> toJson() => {
    'version': 1,
    'accountId': accountId,
    'requestId': requestId,
    'assetId': assetId,
    'durationMs': durationMs,
    'title': title,
  };

  factory PendingTalkPublish.fromJson(Object? value) {
    if (value is! Map<String, dynamic> || value.length != 6 ||
        value['version'] != 1 ||
        value['accountId'] is! String ||
        value['requestId'] is! String ||
        value['assetId'] is! String ||
        value['durationMs'] is! int ||
        value['title'] is! String) {
      throw const FormatException('Invalid saved Talk attempt');
    }
    final attempt = PendingTalkPublish(
      accountId: value['accountId'] as String,
      requestId: value['requestId'] as String,
      assetId: value['assetId'] as String,
      durationMs: value['durationMs'] as int,
      title: value['title'] as String,
    );
    if (!attempt.isValid) throw const FormatException('Invalid saved Talk attempt');
    return attempt;
  }
}

/// Isolated so widget tests can exercise actual save/read/clear behavior.
abstract class TalkPublishAttemptStore {
  Future<PendingTalkPublish?> read(String accountId);
  Future<void> write(PendingTalkPublish attempt);
  Future<void> clear(String accountId, String requestId);
}

/// A single encrypted device-local recovery slot. Never store raw audio,
/// signed URLs or bearer credentials. Wrong-account reads disclose nothing.
class SecureTalkPublishAttemptStore implements TalkPublishAttemptStore {
  SecureTalkPublishAttemptStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'masanawa.talks.pending-publish.v1';

  Future<PendingTalkPublish?> _readAny() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    return PendingTalkPublish.fromJson(jsonDecode(raw));
  }

  @override
  Future<PendingTalkPublish?> read(String accountId) async {
    final saved = await _readAny();
    return saved?.accountId == accountId ? saved : null;
  }

  @override
  Future<void> write(PendingTalkPublish attempt) async {
    if (!attempt.isValid) throw const FormatException('Invalid Talk attempt');
    await _storage.write(key: _key, value: jsonEncode(attempt.toJson()));
  }

  @override
  Future<void> clear(String accountId, String requestId) async {
    final saved = await _readAny();
    if (saved?.accountId == accountId && saved?.requestId == requestId) {
      await _storage.delete(key: _key);
    }
  }
}
