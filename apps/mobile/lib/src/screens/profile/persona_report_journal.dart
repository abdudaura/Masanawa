import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../talks/talk_safety.dart';

/// Minimal private report request, persisted before POST so a crash or
/// ambiguous response replays the *same* authenticated idempotency key.
class PendingPersonaReport {
  const PendingPersonaReport({
    required this.userId,
    required this.publicId,
    required this.clientRequestId,
    required this.reason,
    required this.detail,
  });

  final String userId;
  final String publicId;
  final String clientRequestId;
  final TalkSafetyReportReason reason;
  final String detail;

  Map<String, dynamic> toJson() => {
        'version': 1,
        'userId': userId,
        'publicId': publicId,
        'clientRequestId': clientRequestId,
        'reason': reason.wire,
        'detail': detail,
      };

  static PendingPersonaReport parse(
    String value, {
    required String userId,
    required String publicId,
  }) {
    final decoded = jsonDecode(value);
    if (decoded is! Map<String, dynamic> || decoded['version'] != 1 ||
        decoded['userId'] != userId || decoded['publicId'] != publicId) {
      throw const FormatException('Invalid private report journal ownership');
    }
    final id = decoded['clientRequestId'];
    final detail = decoded['detail'];
    final wireReason = decoded['reason'];
    if (id is! String || id.isEmpty || id.length > 256 ||
        detail is! String || detail.length > 2000 ||
        wireReason is! String) {
      throw const FormatException('Invalid private report journal');
    }
    TalkSafetyReportReason? reason;
    for (final candidate in TalkSafetyReportReason.values) {
      if (candidate.wire == wireReason) {
        reason = candidate;
        break;
      }
    }
    if (reason == null) {
      throw const FormatException('Invalid private report reason');
    }
    return PendingPersonaReport(
      userId: userId,
      publicId: publicId,
      clientRequestId: id,
      reason: reason,
      detail: detail,
    );
  }
}

abstract interface class PersonaReportJournal {
  Future<PendingPersonaReport?> read({
    required String userId,
    required String publicId,
  });

  Future<void> write(PendingPersonaReport report);

  Future<void> clear({
    required String userId,
    required String publicId,
  });
}

/// Storage values are encrypted by Android Keystore / iOS Keychain.
/// The key is account-and-persona-scoped, not shared with public Talk cache.
class SecurePersonaReportJournal implements PersonaReportJournal {
  SecurePersonaReportJournal({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );

  final FlutterSecureStorage _storage;

  String _key(String userId, String publicId) =>
      'r15_persona_report_v1_' +
      base64Url.encode(utf8.encode(userId + '\u0000' + publicId));

  @override
  Future<PendingPersonaReport?> read({
    required String userId,
    required String publicId,
  }) async {
    final raw = await _storage.read(key: _key(userId, publicId));
    if (raw == null) return null;
    // Corrupt entries fail closed; never silently create another report ID.
    return PendingPersonaReport.parse(
      raw, userId: userId, publicId: publicId,
    );
  }

  @override
  Future<void> write(PendingPersonaReport report) =>
      _storage.write(
        key: _key(report.userId, report.publicId),
        value: jsonEncode(report.toJson()),
      );

  @override
  Future<void> clear({
    required String userId,
    required String publicId,
  }) => _storage.delete(key: _key(userId, publicId));
}

final personaReportJournalProvider = Provider<PersonaReportJournal>(
  (_) => SecurePersonaReportJournal(),
);
