import '../core/network/api_client.dart';
import 'twin_quality.dart';

/// Auth and refresh are handled by the canonical ApiClient, not this module.
class GatewayTwinQualityTransport implements TwinQualityTransport {
  const GatewayTwinQualityTransport(this.api);
  final ApiClient api;
  @override
  Future<TwinQualityReport> load() async {
    final response = await api.dio.get<dynamic>('/v1/twin-quality',queryParameters:{'limit':50});
    if (response.data is! Map) throw const FormatException('Invalid Twin quality response');
    return TwinQualityReport.fromJson((response.data as Map).cast<String,dynamic>());
  }
}
