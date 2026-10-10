import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'public_discovery_models.dart';

abstract interface class PublicDiscoveryTransport {
  Future<PublicDiscoveryPage> search({
    required String query, required PublicDiscoveryFilter filter,
    required bool liveOnly, required int offset,
  });
}

class GatewayPublicDiscoveryTransport implements PublicDiscoveryTransport {
  GatewayPublicDiscoveryTransport(this.api);
  final ApiClient api;

  @override
  Future<PublicDiscoveryPage> search({
    required String query, required PublicDiscoveryFilter filter,
    required bool liveOnly, required int offset,
  }) async {
    if (api.accessToken == null || api.accessToken!.isEmpty) {
      throw const ApiException('Sign in to search Masanawa.',
        statusCode: 401, code: 'AUTH_REQUIRED');
    }
    final value = query.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (value.length < 2 || value.length > 120 ||
        RegExp(r'[\x00-\x1f\x7f]').hasMatch(value)) {
      throw const FormatException('Search needs 2–120 normal characters');
    }
    if (offset < 0 || offset > 49) {
      throw RangeError.range(offset, 0, 49);
    }
    // No offline placeholder: 404 here is a missing deployment, not "no people".
    final response = await api.dio.get<dynamic>(
      '/discovery/public',
      queryParameters: {
        'q': value, 'type': filter.name, 'liveOnly': liveOnly,
        'offset': offset, 'limit': 20,
      },
    );
    return PublicDiscoveryPage.fromJson(response.data);
  }
}
