import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../agents/agent_directory.dart';
import '../agents/masanawa_transport.dart';
import '../core/network/api_client.dart';

String normalizeAgentGatewayUrl(String value) {
  final uri = Uri.tryParse(value.trim());
  final loopback =
      uri != null &&
      const ['localhost', '127.0.0.1', '::1', '[::1]'].contains(uri.host);
  if (uri == null ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.hasFragment ||
      (uri.path.isNotEmpty && uri.path != '/') ||
      (uri.scheme != 'https' && !(loopback && uri.scheme == 'http'))) {
    throw const FormatException(
      'Use an HTTPS Gateway address, or localhost for USB testing.',
    );
  }
  return uri.replace(path: '').toString();
}

class AgentConnection {
  const AgentConnection({
    this.baseUrl = '',
    this.enabled = false,
    this.token,
    this.restoring = false,
  });
  final String baseUrl;
  final bool enabled;
  final String? token;
  final bool restoring;
  bool get configured => enabled && baseUrl.isNotEmpty && !restoring;

  @override
  String toString() =>
      'AgentConnection(configured: $configured, token: [REDACTED])';
}

abstract class AgentConnectionStore {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

class SecureAgentConnectionStore implements AgentConnectionStore {
  static const _key = 'masanawa_debug_agent_connection_v1';
  static const _storage = FlutterSecureStorage();
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}

final agentConnectionStoreProvider = Provider<AgentConnectionStore>(
  (_) => SecureAgentConnectionStore(),
);

class AgentConnectionController extends Notifier<AgentConnection> {
  int _revision = 0;
  bool _disposed = false;

  AgentConnection get _buildConnection => const AgentConnection(
    baseUrl: kAgentBaseUrl,
    enabled: kAgentRuntimeEnabled,
  );

  @override
  AgentConnection build() {
    ref.onDispose(() {
      _disposed = true;
      _revision++;
    });
    if (!kDebugMode) return _buildConnection;
    scheduleMicrotask(_restore);
    return const AgentConnection(
      baseUrl: kAgentBaseUrl,
      enabled: kAgentRuntimeEnabled,
      restoring: true,
    );
  }

  Future<void> _restore() async {
    final revision = _revision;
    try {
      final raw = await ref.read(agentConnectionStoreProvider).read();
      if (_disposed || revision != _revision) return;
      if (raw != null) {
        final data = jsonDecode(raw) as Map<String, dynamic>;
        final url = normalizeAgentGatewayUrl(data['baseUrl'] as String);
        final token = (data['token'] as String).trim();
        if (token.isEmpty || RegExp(r'\s').hasMatch(token)) {
          throw const FormatException();
        }
        state = AgentConnection(baseUrl: url, enabled: true, token: token);
        return;
      }
    } catch (_) {
      // Unreadable secure settings never invent a credential or block startup.
    }
    if (!_disposed && revision == _revision) state = _buildConnection;
  }

  Future<List<AgentDirectoryEntry>> connect({
    required String baseUrl,
    required String token,
    required Future<List<AgentDirectoryEntry>> Function(String, String) verify,
  }) async {
    if (!kDebugMode) throw StateError('Debug connection is unavailable');
    final url = normalizeAgentGatewayUrl(baseUrl);
    final cleanToken = token.trim();
    if (cleanToken.isEmpty ||
        cleanToken.length > 4096 ||
        RegExp(r'\s').hasMatch(cleanToken)) {
      throw const FormatException(
        'Enter the Alpha access token from this Gateway.',
      );
    }
    final revision = ++_revision;
    // Verify the authorized directory before replacing a working connection.
    final agents = await verify(url, cleanToken);
    if (_disposed || revision != _revision) {
      throw StateError('Connection changed');
    }
    await ref
        .read(agentConnectionStoreProvider)
        .write(jsonEncode({'baseUrl': url, 'token': cleanToken}));
    if (_disposed || revision != _revision) {
      throw StateError('Connection changed');
    }
    state = AgentConnection(baseUrl: url, enabled: true, token: cleanToken);
    return agents;
  }

  Future<void> reset() async {
    if (!kDebugMode) throw StateError('Debug connection is unavailable');
    ++_revision;
    await ref.read(agentConnectionStoreProvider).clear();
    if (!_disposed) state = _buildConnection;
  }
}

final agentConnectionProvider =
    NotifierProvider<AgentConnectionController, AgentConnection>(
      AgentConnectionController.new,
    );

class UnavailableAgentDirectoryTransport implements AgentDirectoryTransport {
  const UnavailableAgentDirectoryTransport();
  @override
  Future<List<AgentDirectoryEntry>> loadDirectory() async {
    throw const ApiException(
      'Connection unavailable',
      code: 'AGENT_CONNECTION_REQUIRED',
    );
  }
}
