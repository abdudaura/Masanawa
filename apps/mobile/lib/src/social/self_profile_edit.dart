import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'talk_social_profiles.dart';

/// The only fields a user can edit in a public identity. User/tenant identity,
/// avatar references and audience statistics never come from the client.
class SelfProfileDraft {
  const SelfProfileDraft({
    required this.handle,
    required this.displayName,
    required this.bio,
  });

  final String handle;
  final String displayName;
  final String bio;

  String get normalizedHandle =>
      handle.trim().toLowerCase().replaceFirst(RegExp(r'^@'), '');

  String get normalizedName => displayName.trim();
  String get normalizedBio => bio.trim();

  String? validate() {
    if (!RegExp(r'^[a-z0-9_][a-z0-9_.-]{1,39}$').hasMatch(normalizedHandle)) {
      return 'Use 2–40 lowercase letters, numbers, dots, dashes or underscores for your handle.';
    }
    if (normalizedName.isEmpty || normalizedName.length > 160 ||
        RegExp(r'[\x00-\x1F\x7F]').hasMatch(normalizedName)) {
      return 'Enter a display name of up to 160 characters.';
    }
    if (normalizedBio.length > 1000 ||
        RegExp(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]').hasMatch(normalizedBio)) {
      return 'Bio must be at most 1,000 characters.';
    }
    return null;
  }

  Map<String, String> toJson() => {
        'handle': normalizedHandle,
        'displayName': normalizedName,
        'bio': normalizedBio,
      };
}

class ProfileHandleTaken implements Exception {
  const ProfileHandleTaken();
}

abstract interface class SelfProfileEditTransport {
  Future<HumanProfile> save(SelfProfileDraft draft);
}

class GatewaySelfProfileEditTransport implements SelfProfileEditTransport {
  const GatewaySelfProfileEditTransport(this.api);
  final ApiClient api;

  @override
  Future<HumanProfile> save(SelfProfileDraft draft) async {
    final error = draft.validate();
    if (error != null) throw ArgumentError(error);
    try {
      final response = await api.dio.put<dynamic>(
        '/profiles/me',
        data: draft.toJson(),
      );
      final value = response.data;
      if (value is Map<String, dynamic>) return HumanProfile.fromJson(value);
      if (value is Map) return HumanProfile.fromJson(value.cast<String, dynamic>());
      throw const FormatException('Invalid profile response');
    } on DioException catch (error) {
      if (error.response?.statusCode == 409) {
        throw const ProfileHandleTaken();
      }
      rethrow;
    }
  }
}
