import 'package:dio/dio.dart';

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

  @override
  Future<TwinDirectoryEntry?> resolve({
    required String publicId,
  }) async {
    try {
      final response = await api.dio.get<dynamic>(
        '/agent/twins/${Uri.encodeComponent(publicId)}',
      );
      final data = response.data;
      if (data is Map<String, dynamic>) {
        return TwinDirectoryEntry.fromJson(data);
      }
      if (data is Map) {
        return TwinDirectoryEntry.fromJson(data.cast<String, dynamic>());
      }
      throw const FormatException('Invalid public twin response');
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) return null;
      rethrow;
    }
  }
}
