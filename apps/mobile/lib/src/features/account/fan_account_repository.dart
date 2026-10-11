import 'package:dio/dio.dart';

/// C05 reads the canonical fan profile from C04's /v1/me endpoint.
/// Auth headers and session refresh belong to the app's existing Dio instance.
/// No token, fan ID, or tenant ID is taken from caller-controlled query parameters.
abstract interface class FanAccountRepository {
  String get accountKey;
  bool get isCurrentAccount;
  Future<FanAccountSummary> read();
}

class FanAccountSummary {
  const FanAccountSummary({
    required this.revision,
    required this.completed,
    this.displayName,
    this.language = 'en',
  });

  final int revision;
  final bool completed;
  final String? displayName;
  final String language;

  factory FanAccountSummary.fromJson(Map<String, dynamic> value) {
    final revision = value['revision'];
    if (revision is! int || revision < 1 ||
        value['completed'] is! bool) {
      throw const FormatException('Invalid private account projection');
    }
    final name = value['displayName'];
    if (name != null && name is! String) {
      throw const FormatException('Invalid display name');
    }
    return FanAccountSummary(
      revision: revision,
      completed: value['completed'] as bool,
      displayName: name as String?,
      language: value['preferredLanguage'] == 'ha' ? 'ha' : 'en',
    );
  }
}

class DioFanAccountRepository implements FanAccountRepository {
  DioFanAccountRepository({
    required this.dio,
    required this.accountKey,
    required this.currentAccount,
  });

  final Dio dio;

  /// Opaque local account-switch fence only. Never transmitted to the API.
  @override
  final String accountKey;
  final bool Function() currentAccount;

  @override
  bool get isCurrentAccount => accountKey.isNotEmpty && currentAccount();

  @override
  Future<FanAccountSummary> read() async {
    if (!isCurrentAccount) throw StateError('account_changed');
    final response = await dio.get<Map<String, dynamic>>(
      '/v1/me',
      options: Options(headers: const {'Cache-Control': 'no-store'}),
    );
    if (!isCurrentAccount) throw StateError('account_changed');
    final body = response.data;
    if (body == null) throw const FormatException('Empty account response');
    return FanAccountSummary.fromJson(body);
  }
}
