import '../core/network/api_client.dart';
import 'twin_profile.dart';

class GatewayTwinProfileTransport implements TwinProfileTransport {
  GatewayTwinProfileTransport({required this.api});

  final ApiClient api;

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid My Twin response');
  }

  @override
  Future<TwinProfile> load() async {
    final response = await api.dio.get<dynamic>('/v1/my-twin');
    return TwinProfile.fromJson(_map(response.data));
  }

  @override
  Future<TwinProfile> setDiscoverable(bool discoverable) async {
    final response = await api.dio.put<dynamic>(
      '/v1/my-twin/discoverability',
      data: {'discoverable': discoverable},
    );
    return TwinProfile.fromJson(_map(response.data));
  }
}
