import 'package:dio/dio.dart';

enum NoticeKind { commentReply, roomAnswer, followedPost, subscription, wallet, caseUpdate }

NoticeKind noticeKind(String raw) {
  switch (raw) {
    case 'comment_reply': return NoticeKind.commentReply;
    case 'room_answer': return NoticeKind.roomAnswer;
    case 'followed_post': return NoticeKind.followedPost;
    case 'subscription': return NoticeKind.subscription;
    case 'wallet': return NoticeKind.wallet;
    case 'case_update': return NoticeKind.caseUpdate;
    default: throw const FormatException('Unknown notification type');
  }
}

class FanNotice {
  const FanNotice({required this.id, required this.kind,
    required this.targetKind, required this.targetId, required this.title,
    required this.body, required this.createdAt, this.readAt});
  final String id;
  final NoticeKind kind;
  final String targetKind;
  final String targetId;
  final String title;
  final String body;
  final DateTime createdAt;
  final DateTime? readAt;
  bool get unread => readAt == null;

  factory FanNotice.fromJson(Map<String, dynamic> json) {
    final id = json['id'];
    final targetKind = json['targetKind'];
    final targetId = json['targetId'];
    final title = json['title'];
    final body = json['body'];
    final created = json['createdAt'];
    if (id is! String || id.isEmpty || id.length > 128 ||
        targetId is! String || targetId.isEmpty || targetId.length > 128 ||
        targetKind is! String || !{'post','comment','room','subscription','wallet','case'}.contains(targetKind) ||
        title is! String || title.isEmpty || title.length > 120 ||
        body is! String || body.isEmpty || body.length > 240 ||
        created is! String || json['kind'] is! String) {
      throw const FormatException('Malformed notification');
    }
    final createdAt = DateTime.tryParse(created);
    if (createdAt == null) throw const FormatException('Invalid time');
    DateTime? readAt;
    if (json['readAt'] != null) {
      final read = json['readAt'];
      if (read is! String || DateTime.tryParse(read) == null) {
        throw const FormatException('Invalid read time');
      }
      readAt = DateTime.parse(read);
    }
    final kind = noticeKind(json['kind'] as String);
    const expected = {
      NoticeKind.commentReply: 'comment', NoticeKind.roomAnswer: 'room',
      NoticeKind.followedPost: 'post', NoticeKind.subscription: 'subscription',
      NoticeKind.wallet: 'wallet', NoticeKind.caseUpdate: 'case',
    };
    if (expected[kind] != targetKind) throw const FormatException('Mismatched notification target');
    return FanNotice(id: id, kind: kind, targetKind: targetKind,
      targetId: targetId, title: title, body: body, createdAt: createdAt,
      readAt: readAt);
  }

  FanNotice copyRead() => FanNotice(id: id, kind: kind, targetKind: targetKind,
    targetId: targetId, title: title, body: body, createdAt: createdAt,
    readAt: DateTime.now().toUtc());
}

class FanNoticePage {
  const FanNoticePage(this.items, this.nextCursor);
  final List<FanNotice> items;
  final String? nextCursor;
  factory FanNoticePage.fromJson(Map<String, dynamic> data) {
    final raw = data['items'];
    final next = data['nextCursor'];
    if (raw is! List || (next != null && (next is! String || next.length > 512))) {
      throw const FormatException('Malformed notification page');
    }
    final parsed = raw.map((value) {
      if (value is! Map) throw const FormatException('Malformed notification');
      return FanNotice.fromJson(Map<String, dynamic>.from(value));
    }).toList(growable: false);
    return FanNoticePage(parsed, next as String?);
  }
}

/// The authenticated Dio client is supplied by the existing session authority.
/// The transport never copies bearer credentials into UI state or disk.
abstract class FanNotificationTransport {
  String get ownerAccountId;
  bool get isCurrentAccount;
  Future<FanNoticePage> list({String? cursor});
  Future<void> markRead(String notificationId);
}

class DioFanNotificationTransport implements FanNotificationTransport {
  DioFanNotificationTransport({required this.dio, required this.ownerAccountId,
    required this.currentAccountId});
  final Dio dio;
  @override
  final String ownerAccountId;
  final String? Function() currentAccountId;
  @override
  bool get isCurrentAccount => ownerAccountId.isNotEmpty &&
      currentAccountId() == ownerAccountId;

  void _verify() {
    if (!isCurrentAccount) throw StateError('Account changed. Refresh after signing in.');
  }

  @override
  Future<FanNoticePage> list({String? cursor}) async {
    _verify();
    final response = await dio.get<dynamic>('/v1/notifications',
      queryParameters: {'limit': 30, if (cursor != null) 'cursor': cursor});
    _verify();
    if (response.data is! Map) throw const FormatException('Malformed notification response');
    return FanNoticePage.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  @override
  Future<void> markRead(String notificationId) async {
    _verify();
    if (!RegExp(r'^[a-zA-Z0-9_:\-.]{1,128}$').hasMatch(notificationId)) {
      throw const FormatException('Invalid notification id');
    }
    final response = await dio.post<dynamic>(
      '/v1/notifications/${Uri.encodeComponent(notificationId)}/read');
    _verify();
    if (response.data is! Map || (response.data as Map)['id'] != notificationId ||
        (response.data as Map)['read'] != true) {
      throw const FormatException('Missing notification acknowledgement');
    }
  }
}
