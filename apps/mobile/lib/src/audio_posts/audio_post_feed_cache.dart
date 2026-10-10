import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'audio_post_transport.dart';

/// Presentation-only snapshots of previously visible *published* Talks.
/// Never treat an offline snapshot as fresh publication/visibility authority.
abstract class PublishedTalkFeedCache {
  Future<List<AudioPost>?> read(String accountId);
  Future<void> write(String accountId, List<AudioPost> posts);
  Future<void> clear(String accountId);
}

class SecurePublishedTalkFeedCache implements PublishedTalkFeedCache {
  SecurePublishedTalkFeedCache({FlutterSecureStorage? storage,
      DateTime Function()? now})
      : _storage = storage ?? const FlutterSecureStorage(),
        _now = now ?? DateTime.now;

  final FlutterSecureStorage _storage;
  final DateTime Function() _now;
  Future<void> _pending = Future<void>.value();
  static const _prefix = 'masanawa.talks.published-feed.v1.';
  static const _maxAge = Duration(hours: 24);
  static const _maxItems = 20;
  static const _maxBytes = 32768;

  static String _key(String accountId) {
    if (accountId.trim().isEmpty || accountId.length > 256) {
      throw const FormatException('Invalid Talks account');
    }
    return _prefix + base64Url.encode(utf8.encode(accountId));
  }

  @override
  Future<List<AudioPost>?> read(String accountId) async {
    final key = _key(accountId);
    await _pending; // Observe a pending write/clear for this cache instance.
    final raw = await _storage.read(key: key);
    if (raw == null) return null;
    if (raw.length > _maxBytes) throw const FormatException('Oversized Talks cache');
    final value = jsonDecode(raw);
    if (value is! Map<String, dynamic> ||
        value['version'] != 1 || value['accountId'] != accountId ||
        value['savedAt'] is! String || value['items'] is! List) {
      throw const FormatException('Invalid Talks cache');
    }
    final savedAt = DateTime.tryParse(value['savedAt'] as String)?.toUtc();
    final age = savedAt == null ? null : _now().toUtc().difference(savedAt);
    if (age == null || age.isNegative || age > _maxAge) return null;
    final items = value['items'] as List;
    if (items.length > _maxItems) throw const FormatException('Oversized Talks list');
    return List.unmodifiable(items.map((item) {
      if (item is! Map) throw const FormatException('Invalid cached Talk');
      final post = AudioPost.fromJson(item.cast<String, dynamic>());
      if (post.status != 'published') {
        throw const FormatException('Unpublished cached Talk');
      }
      return post;
    }));
  }

  // Operations are serialized so a delayed disk write cannot resurrect a
  // snapshot after account logout/switch clears it.
  Future<void> _enqueue(Future<void> Function() work) {
    final next = _pending.catchError((Object _) {}).then((_) => work());
    _pending = next;
    return next;
  }

  @override
  Future<void> write(String accountId, List<AudioPost> posts) {
    final key = _key(accountId);
    final safe = posts.where((p) => p.status == 'published')
        .take(_maxItems).toList(growable: false);
    final encoded = jsonEncode({
      'version': 1,
      'accountId': accountId,
      'savedAt': _now().toUtc().toIso8601String(),
      'items': [
        for (final p in safe)
          {
            'postId': p.postId,
            'authorId': p.authorId,
            'authorKind': p.authorKind,
            'title': p.title,
            'durationMs': p.durationMs,
            'status': p.status,
            'revision': p.revision,
            'createdAt': p.createdAt.toUtc().toIso8601String(),
            'likeCount': p.likeCount,
            'commentCount': p.commentCount,
          }
      ]
    });
    if (encoded.length > _maxBytes) {
      throw const FormatException('Oversized Talks snapshot');
    }
    return _enqueue(() => _storage.write(key: key, value: encoded));
  }

  @override
  Future<void> clear(String accountId) {
    final key = _key(accountId);
    return _enqueue(() => _storage.delete(key: key));
  }
}
