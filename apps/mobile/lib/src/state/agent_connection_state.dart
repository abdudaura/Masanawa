import 'package:flutter_riverpod/flutter_riverpod.dart';

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

/// Runtime connection is a build/runtime endpoint only. Authentication belongs
/// exclusively to the signed-in platform session and is never stored here.
class AgentConnection {
  const AgentConnection({
    this.baseUrl = '',
    this.enabled = false,
    this.restoring = false,
  });

  final String baseUrl;
  final bool enabled;
  final bool restoring;

  bool get configured => enabled && baseUrl.isNotEmpty && !restoring;

  @override
  String toString() => 'AgentConnection(configured: $configured)';
}

class AgentConnectionController extends Notifier<AgentConnection> {
  @override
  AgentConnection build() => const AgentConnection(
        baseUrl: kAgentBaseUrl,
        enabled: kAgentRuntimeEnabled,
      );
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
