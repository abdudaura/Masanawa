import 'dart:typed_data';
import 'package:dio/dio.dart';

import '../core/network/api_client.dart';

abstract interface class ProfileAvatarTransport {
  Future<String> upload(Uint8List png);
  Future<void> remove();
}

class GatewayProfileAvatarTransport implements ProfileAvatarTransport {
  GatewayProfileAvatarTransport({required this.api});
  final ApiClient api;

  @override
  Future<String> upload(Uint8List png) async {
    if (png.isEmpty || png.lengthInBytes > 2 * 1024 * 1024) {
      throw const FormatException('The cropped photo is too large');
    }
    final response = await api.dio.post<dynamic>(
      '/profiles/me/avatar',
      data: Stream<List<int>>.value(png),
      options: Options(
        contentType: 'image/png',
        headers: {Headers.contentLengthHeader: png.length},
      ),
    );
    final data = response.data;
    if (data is! Map || data['avatarUrl'] is! String ||
        (data['avatarUrl'] as String).trim().isEmpty) {
      throw const FormatException('The server did not confirm a photo URL');
    }
    final url = Uri.tryParse(data['avatarUrl'] as String);
    if (url == null || url.scheme != 'https' || url.host.isEmpty ||
        url.userInfo.isNotEmpty) {
      throw const FormatException('Invalid photo URL from server');
    }
    return url.toString();
  }

  @override
  Future<void> remove() async {
    final response = await api.dio.delete<dynamic>('/profiles/me/avatar');
    if (response.data is! Map || (response.data as Map)['avatarUrl'] != null) {
      throw const FormatException('Could not confirm photo removal');
    }
  }
}
