import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';

import 'agent_directory.dart';

abstract class AgentDirectoryCache {
  Future<List<AgentDirectoryEntry>?> read(String ownerId);
  Future<void> write(String ownerId, List<AgentDirectoryEntry> agents);
  Future<void> clear();
}

/// Narrow adapter so the cache can be tested without writing secrets into
/// local files or mocking native method channels.
abstract interface class AgentDirectoryProtectedStorage {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

final class NativeAgentDirectoryProtectedStorage
    implements AgentDirectoryProtectedStorage {
  const NativeAgentDirectoryProtectedStorage({
    this.storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(),
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
    ),
  });

  final FlutterSecureStorage storage;

  @override
  Future<String?> read(String key) => storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => storage.delete(key: key);
}

/// Compatibility name retained for existing Riverpod providers. Directory
/// snapshots now live ONLY in the platform's encrypted secure storage.
///
/// The old readable JSON snapshot is deleted (never migrated/read) on the
/// next read, write or logout. A failed secure-storage operation does not
/// recreate a plaintext fallback: the app must fetch the real server roster.
///
/// All operations are sequenced, including across cache instances. In
/// particular, a slow pre-logout write cannot recreate a snapshot after
/// clear() completes. This store only caches server presentation, not
/// permission, voice readiness, payment or active presence.
class FileAgentDirectoryCache implements AgentDirectoryCache {
  const FileAgentDirectoryCache({
    this.protectedStorage = const NativeAgentDirectoryProtectedStorage(),
    this.legacyDirectoryProvider,
  });

  final AgentDirectoryProtectedStorage protectedStorage;

  /// Injected only to exercise deletion of legacy plaintext files in tests.
  final Future<Directory> Function()? legacyDirectoryProvider;

  static const _protectedKey = 'masanawa.agent_directory.v2';
  static const _legacyFileName = 'masanawa_agent_directory_v1.json';
  static const _maxAgents = 250;
  static const _maxEncodedLength = 256 * 1024;

  static Future<void> _lastOperation = Future<void>.value();

  static Future<T> _ordered<T>(Future<T> Function() action) {
    final next = _lastOperation.then((_) => action());
    // An inaccessible OS keychain must not permanently poison later reads.
    _lastOperation = next.then<void>(
      (_) {},
      onError: (Object _, StackTrace __) {},
    );
    return next;
  }

  Future<void> _purgeLegacyPlaintext() async {
    try {
      final directory = await (legacyDirectoryProvider?.call() ??
          getApplicationSupportDirectory());
      for (final name in [_legacyFileName, '$_legacyFileName.tmp']) {
        final file = File(directory.path + Platform.pathSeparator + name);
        if (await file.exists()) await file.delete();
      }
    } catch (_) {
      // Native storage remains authoritative; never read or restore legacy
      // plaintext even if an OS filesystem error prevents its deletion.
    }
  }

  @override
  Future<List<AgentDirectoryEntry>?> read(String ownerId) =>
      _ordered(() async {
        await _purgeLegacyPlaintext();
        if (ownerId.trim().isEmpty) return null;
        try {
          final raw = await protectedStorage.read(_protectedKey);
          if (raw == null || raw.length > _maxEncodedLength) return null;
          final decoded = jsonDecode(raw);
          if (decoded is! Map<String, dynamic> ||
              decoded['version'] != 2 ||
              decoded['ownerId'] != ownerId) {
            return null;
          }
          final values = decoded['agents'];
          if (values is! List || values.length > _maxAgents) return null;
          final agents = <AgentDirectoryEntry>[];
          for (final value in values) {
            if (value is! Map<String, dynamic>) return null;
            agents.add(
              AgentDirectoryEntry.fromJson(value).withUnverifiedPresence(),
            );
          }
          return List<AgentDirectoryEntry>.unmodifiable(agents);
        } catch (_) {
          // Malformed, old, wrong-account or unreadable keychain data cannot
          // become a verified availability/identity claim.
          return null;
        }
      });

  @override
  Future<void> write(String ownerId, List<AgentDirectoryEntry> agents) =>
      _ordered(() async {
        await _purgeLegacyPlaintext();
        if (ownerId.trim().isEmpty || agents.length > _maxAgents) return;
        try {
          final snapshot = jsonEncode({
            'version': 2,
            'ownerId': ownerId,
            'agents': [
              for (final agent in agents)
                agent.withUnverifiedPresence().toJson(),
            ],
          });
          if (snapshot.length > _maxEncodedLength) return;
          await protectedStorage.write(_protectedKey, snapshot);
        } catch (_) {
          // Fast start is optional. A failed keychain never triggers a
          // plaintext write, and the authenticated HTTP refresh still works.
        }
      });

  @override
  Future<void> clear() => _ordered(() async {
        await _purgeLegacyPlaintext();
        try {
          await protectedStorage.delete(_protectedKey);
        } catch (_) {
          // A read after a native failure will likewise fail closed; the
          // session/state layer independently discards its in-memory roster.
        }
      });
}
