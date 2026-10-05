import '../core/network/api_client.dart';
import 'twin_directory.dart';

class GatewayTwinDirectoryTransport implements TwinDirectoryTransport {
  GatewayTwinDirectoryTransport({required this.api});

  final ApiClient api;

  @override
  Future<TwinDirectoryPage> search({
    required String query,
    String? cursor,
    int limit = 30,
  }) async {
    final response = await api.dio.get<dynamic>(
      '/agent/twins',
      queryParameters: {
        if (query.trim().isNotEmpty) 'q': query.trim(),
        'limit': limit,
      },
    );

    final data = response.data;
    if (data is! List) {
      throw const FormatException('Invalid twin directory response');
    }

    return TwinDirectoryPage(
      items: [
        for (final item in data)
          if (item is Map)
            TwinDirectoryEntry.fromJson(item.cast<String, dynamic>()),
      ],
      // The current backend contract is a bounded search without cursor
      // pagination. Keep the page shape future-compatible.
      nextCursor: null,
    );
  }
}
