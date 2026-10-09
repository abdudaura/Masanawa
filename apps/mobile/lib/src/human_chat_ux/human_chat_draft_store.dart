import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Unsent local text and a once-only request key are not delivery evidence.
class HumanChatDraft {
  const HumanChatDraft({this.text = '', this.pendingId, this.pendingBody,
      this.replyId, this.replyPreview, this.pendingReplyId});
  final String text;
  final String? pendingId, pendingBody, replyId, replyPreview, pendingReplyId;
  bool get uncertain => pendingId != null;
  Map<String, dynamic> toJson() => {
    'v': 1, 'text': text, 'pendingId': pendingId, 'pendingBody': pendingBody,
    'replyId': replyId, 'replyPreview': replyPreview,
    'pendingReplyId': pendingReplyId,
  };
  factory HumanChatDraft.fromJson(Object? data) {
    if (data is! Map) throw const FormatException('Invalid protected draft');
    final json = data.cast<String, dynamic>();
    if (json['v'] != 1) throw const FormatException('Unknown draft format');
    String? field(String name, int max) {
      final value = json[name];
      if (value == null) return null;
      if (value is! String || value.length > max) {
        throw const FormatException('Corrupt protected draft');
      }
      return value;
    }
    final id = field('pendingId', 128), body = field('pendingBody', 4000);
    if ((id == null) != (body == null) ||
        (id != null && (id.isEmpty || body!.trim().isEmpty))) {
      throw const FormatException('Corrupt pending request');
    }
    return HumanChatDraft(
      text: field('text', 4000) ?? '', pendingId: id, pendingBody: body,
      replyId: field('replyId', 128), replyPreview: field('replyPreview', 180),
      pendingReplyId: field('pendingReplyId', 128),
    );
  }
}

abstract class HumanChatDraftStore {
  Future<HumanChatDraft?> read(String key);
  Future<void> write(String key, HumanChatDraft value);
  Future<void> remove(String key);
}

/// Flutter's existing keystore-backed plugin. Never fall back to plain files.
class SecureHumanChatDraftStore implements HumanChatDraftStore {
  SecureHumanChatDraftStore({FlutterSecureStorage? storage})
      : storage = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage storage;
  @override Future<HumanChatDraft?> read(String key) async {
    final content = await storage.read(key: key);
    return content == null ? null : HumanChatDraft.fromJson(jsonDecode(content));
  }
  @override Future<void> write(String key, HumanChatDraft value) =>
      storage.write(key: key, value: jsonEncode(value.toJson()));
  @override Future<void> remove(String key) => storage.delete(key: key);
}

/// Length-delimited tenant, user and conversation ID prevent key confusion.
String humanDraftKey(String tenantId, String userId, String conversationId) {
  if ([tenantId, userId, conversationId].any((s) => s.isEmpty)) {
    throw ArgumentError('Authenticated identity required for human chat draft');
  }
  String segment(String v) => v.length.toString() + ':' + v;
  return 'human-composer-v1:' +
      segment(tenantId) + segment(userId) + segment(conversationId);
}
