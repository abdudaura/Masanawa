import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';

import '../core/network/api_client.dart';

abstract interface class ProfileAvatarTransport {
  Future<String> upload(Uint8List png, {required String? expectedUrl});
  Future<void> remove({required String expectedUrl});
}

class GatewayProfileAvatarTransport implements ProfileAvatarTransport {
  GatewayProfileAvatarTransport({required this.api});
  final ApiClient api;

  @override
  Future<String> upload(Uint8List png, {required String? expectedUrl}) async {
    if (png.isEmpty || png.lengthInBytes > 2 * 1024 * 1024) {
      throw const FormatException('The cropped photo is too large');
    }
    final response = await api.dio.post<dynamic>(
      '/profiles/me/avatar',
      data: Stream<List<int>>.value(png),
      options: Options(
        contentType: 'image/png',
        headers: {
          Headers.contentLengthHeader: png.length,
          'x-avatar-expected': 'v1:' + base64Url.encode(utf8.encode(expectedUrl ?? '')).replaceAll('=', ''),
        },
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
  Future<void> remove({required String expectedUrl}) async {
    final response = await api.dio.delete<dynamic>(
      '/profiles/me/avatar',
      options: Options(headers: {
        'x-avatar-expected': 'v1:' + base64Url.encode(utf8.encode(expectedUrl)).replaceAll('=', ''),
      }),
    );
    if (response.data is! Map || (response.data as Map)['avatarUrl'] != null) {
      throw const FormatException('Could not confirm photo removal');
    }
  }
}

final profileAvatarTransportProvider = Provider<ProfileAvatarTransport>(
  (ref) => GatewayProfileAvatarTransport(api: ref.watch(apiClientProvider)),
);
