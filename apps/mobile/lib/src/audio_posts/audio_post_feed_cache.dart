import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'audio_post_transport.dart';

/// Encrypted, account-fenced presentation snapshots. No cached row authorizes
/// media access, edits, follows or a publish/delete operation while offline.
abstract class PublishedTalkFeedCache {
  Future<List<AudioPost>?> read(String accountId);
  Future<void> write(String accountId, List<AudioPost> posts);
  Future<void> clear(String accountId);
}

/// Optional extension: old custom caches keep working for Discover, while the
/// real secure cache also restores Following, Saved and My Talks after restart.
abstract class PublishedTalkTabCache implements PublishedTalkFeedCache {
  Future<List<AudioPost>?> readTab(String accountId, String tab);
  Future<void> writeTab(String accountId, String tab, List<AudioPost> posts);
}

class SecurePublishedTalkFeedCache implements PublishedTalkTabCache {
  SecurePublishedTalkFeedCache({
    FlutterSecureStorage? storage,
    DateTime Function()? now,
  })  : _storage = storage ?? const FlutterSecureStorage(),
        _now = now ?? DateTime.now;

  final FlutterSecureStorage _storage;
  final DateTime Function() _now;
  Future<void> _pending = Future<void>.value();
  static const _prefix = 'masanawa.talks.published-feed.v1.';
  static const _tabs = ['discover', 'following', 'saved', 'mine'];
  static const _maxAge = Duration(hours: 24);
  static const _maxItems = 20;
  static const _maxBytes = 32768;

  static String _key(String accountId, String tab) {
    if (accountId.trim().isEmpty || accountId.length > 256 ||
        !_tabs.contains(tab)) {
      throw const FormatException('Invalid Talks cache scope');
    }
    final accountKey = base64Url.encode(utf8.encode(accountId));
    // Do not move the existing Discover key: previously installed clients
    // must still be able to read their encrypted first-page snapshot.
    return tab == 'discover'
        ? _prefix + accountKey
        : _prefix + 'tab.' + accountKey + '.' + tab;
  }

  @override
  Future<List<AudioPost>?> read(String accountId) =>
      readTab(accountId, 'discover');

  @override
  Future<List<AudioPost>?> readTab(String accountId, String tab) async {
    final key = _key(accountId, tab);
    await _pending; // Never read before an earlier write/logout clear settles.
    final raw = await _storage.read(key: key);
    if (raw == null) return null;
    if (utf8.encode(raw).length > _maxBytes) {
      throw const FormatException('Oversized Talks cache');
    }
    final value = jsonDecode(raw);
    if (value is! Map<String, dynamic> ||
        value['version'] != 1 || value['accountId'] != accountId ||
        (value['tab'] != tab &&
            !(tab == 'discover' && value['tab'] == null)) ||
        value['savedAt'] is! String || value['items'] is! List) {
      throw const FormatException('Invalid Talks cache');
    }
    final savedAt = DateTime.tryParse(value['savedAt'] as String)?.toUtc();
    final age = savedAt == null ? null : _now().toUtc().difference(savedAt);
    if (age == null || age.isNegative || age > _maxAge) return null;
    final items = value['items'] as List;
    if (items.length > _maxItems) {
      throw const FormatException('Oversized Talks list');
    }
    return List<AudioPost>.unmodifiable(items.map((item) {
      if (item is! Map) throw const FormatException('Invalid cached Talk');
      final post = AudioPost.fromJson(item.cast<String, dynamic>());
      // Only a signed-in user's own history can contain nonpublic states.
      if (tab != 'mine' && post.status != 'published') {
        throw const FormatException('Nonpublic cached Talk');
      }
      return post;
    }));
  }

  // A queued write must finish before logout deletes ALL account-owned tabs.
  // No delayed disk write is allowed to restore a revoked account's projection.
  Future<void> _enqueue(Future<void> Function() work) {
    final next = _pending.catchError((Object _) {}).then((_) => work());
    _pending = next;
    return next;
  }

  @override
  Future<void> write(String accountId, List<AudioPost> posts) =>
      writeTab(accountId, 'discover', posts);

  @override
  Future<void> writeTab(
      String accountId, String tab, List<AudioPost> posts) {
    final key = _key(accountId, tab);
    final safe = posts.where((p) =>
        tab == 'mine' || p.status == 'published')
        .take(_maxItems).toList(growable: false);
    final encoded = jsonEncode({
      'version': 1,
      'accountId': accountId,
      'tab': tab,
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
            if (p.listenCount != null) 'listenCount': p.listenCount,
          }
      ],
    });
    if (utf8.encode(encoded).length > _maxBytes) {
      throw const FormatException('Oversized Talks snapshot');
    }
    return _enqueue(() => _storage.write(key: key, value: encoded));
  }

  @override
  Future<void> clear(String accountId) {
    final keys = [for (final tab in _tabs) _key(accountId, tab)];
    return _enqueue(() async {
      for (final key in keys) {
        await _storage.delete(key: key);
      }
    });
  }
}
