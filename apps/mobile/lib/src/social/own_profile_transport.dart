import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../core/providers.dart';
import 'talk_social_profiles.dart';

/// Owner-only editing; never infer edit permission from a public profile page.
abstract interface class OwnProfileTransport {
  Future<HumanProfile> loadSelf();
  Future<HumanProfile> createSelf({
    required String handle,
    required String displayName,
    required String bio,
  });
  Future<HumanProfile> updateSelf({
    String? displayName,
    String? bio,
    bool removeAvatar = false,
  });
}

class GatewayOwnProfileTransport implements OwnProfileTransport {
  GatewayOwnProfileTransport({required this.api});
  final ApiClient api;

  HumanProfile _parse(dynamic response) {
    if (response is! Map) {
      throw const FormatException('Invalid account profile response');
    }
    return HumanProfile.fromJson(response.cast<String, dynamic>());
  }

  @override
  Future<HumanProfile> loadSelf() async {
    final response = await api.dio.get<dynamic>('/profiles/me');
    return _parse(response.data);
  }

  @override
  Future<HumanProfile> createSelf({
    required String handle,
    required String displayName,
    required String bio,
  }) async {
    final response = await api.dio.put<dynamic>(
      '/profiles/me',
      data: {
        'handle': handle,
        'displayName': displayName,
        'bio': bio,
      },
    );
    return _parse(response.data);
  }

  @override
  Future<HumanProfile> updateSelf({
    String? displayName,
    String? bio,
    bool removeAvatar = false,
  }) async {
    final body = <String, dynamic>{
      if (displayName != null) 'displayName': displayName,
      if (bio != null) 'bio': bio,
      if (removeAvatar) 'removeAvatar': true,
    };
    if (body.isEmpty) {
      throw ArgumentError('No profile changes supplied');
    }
    final response = await api.dio.patch<dynamic>(
      '/profiles/me',
      data: body,
    );
    return _parse(response.data);
  }
}

final ownProfileTransportProvider = Provider<OwnProfileTransport>(
  (ref) => GatewayOwnProfileTransport(api: ref.watch(apiClientProvider)),
);
