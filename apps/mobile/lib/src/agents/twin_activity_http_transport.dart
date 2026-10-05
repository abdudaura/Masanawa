import '../core/network/api_client.dart';
import '../agents/twin_activity.dart';

class GatewayTwinActivityTransport implements TwinActivityTransport {
  GatewayTwinActivityTransport({required this.api});

  final ApiClient api;

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid twin Activity response');
  }

  @override
  Future<TwinActivityView> load({int limit = 50}) async {
    final response = await api.dio.get<dynamic>(
      '/agent/twin/activity',
      queryParameters: {'limit': limit},
    );
    return TwinActivityView.fromJson(_map(response.data));
  }
}
