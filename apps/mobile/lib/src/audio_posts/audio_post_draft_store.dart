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

/// Account-isolated encrypted recovery slots. A failed/unknown publish for
/// account A must not disappear when account B publishes on the same device.
/// Keys encode an opaque account ID only for namespacing, not authorization;
/// FlutterSecureStorage encrypts the *value*. No raw audio or tokens are saved.
class SecureTalkPublishAttemptStore implements TalkPublishAttemptStore {
  SecureTalkPublishAttemptStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  // Read-once legacy migration preserves attempts from the earlier single-slot
  // implementation without overwriting another account's pending request.
  static const _legacyKey = 'masanawa.talks.pending-publish.v1';
  static const _scopedPrefix = 'masanawa.talks.pending-publish.v2.';

  static String _keyFor(String accountId) {
    if (accountId.trim().isEmpty || accountId.length > 256) {
      throw const FormatException('Invalid Talk recovery account');
    }
    return '$_scopedPrefix${base64Url.encode(utf8.encode(accountId))}';
  }

  static PendingTalkPublish _decode(String raw) =>
      PendingTalkPublish.fromJson(jsonDecode(raw));

  Future<PendingTalkPublish?> _legacy() async {
    final raw = await _storage.read(key: _legacyKey);
    return raw == null ? null : _decode(raw);
  }

  @override
  Future<PendingTalkPublish?> read(String accountId) async {
    final key = _keyFor(accountId);
    final raw = await _storage.read(key: key);
    if (raw != null) {
      final saved = _decode(raw);
      // Even corrupted/mis-scoped encrypted state cannot cross account fences.
      if (saved.accountId != accountId) {
        throw const FormatException('Talk recovery account mismatch');
      }
      return saved;
    }
    final old = await _legacy();
    if (old == null || old.accountId != accountId) return null;
    // Never delete the legacy attempt until the per-account write succeeds.
    await _storage.write(key: key, value: jsonEncode(old.toJson()));
    await _storage.delete(key: _legacyKey);
    return old;
  }

  @override
  Future<void> write(PendingTalkPublish attempt) async {
    if (!attempt.isValid) throw const FormatException('Invalid Talk attempt');
    // A second composer instance or a restart must not overwrite an earlier
    // uncertain same-account request. Same-key, same-payload replay is safe.
    final prior = await read(attempt.accountId);
    if (prior != null &&
        (prior.requestId != attempt.requestId ||
         prior.assetId != attempt.assetId ||
         prior.durationMs != attempt.durationMs ||
         prior.title != attempt.title)) {
      throw const FormatException('Another Talk publish attempt is pending');
    }
    await _storage.write(
      key: _keyFor(attempt.accountId), value: jsonEncode(attempt.toJson()));
  }

  @override
  Future<void> clear(String accountId, String requestId) async {
    final key = _keyFor(accountId);
    final raw = await _storage.read(key: key);
    if (raw != null) {
      final saved = _decode(raw);
      if (saved.accountId != accountId) {
        throw const FormatException('Talk recovery account mismatch');
      }
      if (saved.requestId == requestId) await _storage.delete(key: key);
    }
    // Clear an old slot only for its own account+request. Account B cannot
    // erase A's pending attempt, even when the old client left a legacy slot.
    final old = await _legacy();
    if (old?.accountId == accountId && old?.requestId == requestId) {
      await _storage.delete(key: _legacyKey);
    }
  }
}
