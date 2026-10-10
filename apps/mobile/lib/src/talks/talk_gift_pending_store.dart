import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// A gift's idempotency identifier is stored before its first network send.
/// `pending:<requestId>` is reused after a crash/timeout; a confirmed
/// `completed:<requestId>` allows the *next explicitly confirmed gift* to get
/// a different ID. Never store bearer tokens or recipient decisions here.
abstract interface class TalkGiftPendingStore {
  Future<String?> read({
    required String userId,
    required String fingerprint,
  });

  Future<void> write({
    required String userId,
    required String fingerprint,
    required String record,
  });
}

/// Encrypted per-account request state, separated from the session record.
/// Errors are propagated: silently regenerating a request ID risks double debit.
class SecureTalkGiftPendingStore implements TalkGiftPendingStore {
  SecureTalkGiftPendingStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );

  final FlutterSecureStorage _storage;

  String _key(String userId, String fingerprint) {
    if (userId.trim().isEmpty || fingerprint.trim().isEmpty) {
      throw const FormatException('A signed-in gift owner and task are required');
    }
    // Encoding avoids delimiter collision between accounts and task fields.
    final scope = base64Url.encode(utf8.encode(userId));
    final task = base64Url.encode(utf8.encode(fingerprint));
    return 'talk_gift_v1_${scope}_${task}';
  }

  @override
  Future<String?> read({
    required String userId,
    required String fingerprint,
  }) =>
      _storage.read(key: _key(userId, fingerprint));

  @override
  Future<void> write({
    required String userId,
    required String fingerprint,
    required String record,
  }) {
    if (record.length > 300 || !RegExp(
      r'^(pending|completed):talk-gift-[0-9]+(?:-[0-9]+){3}$'
    ).hasMatch(record)) {
      throw const FormatException('Invalid durable gift request state');
    }
    return _storage.write(
      key: _key(userId, fingerprint),
      value: record,
    );
  }
}
