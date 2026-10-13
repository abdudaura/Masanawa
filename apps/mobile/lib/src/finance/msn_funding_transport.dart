import 'package:dio/dio.dart';

import '../core/network/api_client.dart';

/// Read-only funded operation. NGN is metadata, never a customer wallet asset.
class MsnFundingOperation {
  const MsnFundingOperation._({
    required this.quoteId,
    required this.fundingReference,
    required this.fundingRail,
    required this.ngnFundingKobo,
    required this.backingAsset,
    required this.backingNetwork,
    required this.state,
    required this.issuedMsnMicro,
  });

  final String quoteId;
  final String fundingReference;
  final String fundingRail;
  final String? ngnFundingKobo;
  final String backingAsset;
  final String backingNetwork;
  final String state;
  final String? issuedMsnMicro;

  factory MsnFundingOperation.fromJson(Map<String, dynamic> json) {
    final quoteId = json['quoteId'];
    final fundingReference = json['fundingReference'];
    final rail = json['fundingRail'];
    final ngn = json['ngnFundingKobo'];
    final backingAsset = json['backingAsset'];
    final backingNetwork = json['backingNetwork'];
    final state = json['state'];
    final issued = json['issuedMsnMicro'];
    final idPattern = RegExp(r'^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$');
    final microPattern = RegExp(r'^[1-9][0-9]*$');
    if (quoteId is! String || !idPattern.hasMatch(quoteId) ||
        fundingReference is! String || !idPattern.hasMatch(fundingReference) ||
        rail != 'NGN_FLUTTERWAVE' && rail != 'NOWPAYMENTS_CRYPTO' ||
        backingAsset is! String ||
        !RegExp(r'^[A-Z0-9_-]{2,32}$').hasMatch(backingAsset) ||
        backingNetwork is! String ||
        !RegExp(r'^[a-z0-9_-]{2,64}$').hasMatch(backingNetwork) ||
        !<String>{
          'awaiting_verified_funding',
          'fiat_verified_backing_pending',
          'backed_issued',
        }.contains(state) ||
        (rail == 'NGN_FLUTTERWAVE' &&
            (ngn is! String || !microPattern.hasMatch(ngn))) ||
        (rail == 'NOWPAYMENTS_CRYPTO' && ngn != null) ||
        (state == 'backed_issued' &&
            (issued is! String || !microPattern.hasMatch(issued))) ||
        (state != 'backed_issued' && issued != null)) {
      throw const FormatException('Invalid MSN funding status');
    }
    return MsnFundingOperation._(
      quoteId: quoteId as String,
      fundingReference: fundingReference as String,
      fundingRail: rail as String,
      ngnFundingKobo: ngn as String?,
      backingAsset: backingAsset as String,
      backingNetwork: backingNetwork as String,
      state: state as String,
      issuedMsnMicro: issued as String?,
    );
  }

  String get statusLabel => switch (state) {
    'awaiting_verified_funding' => 'Waiting for verified funding',
    'fiat_verified_backing_pending' => 'Payment verified · backing pending',
    'backed_issued' => 'MSN issued',
    _ => 'Status unavailable',
  };

  String? get issuedAmount {
    final amount = issuedMsnMicro;
    if (amount == null) return null;
    final v = BigInt.parse(amount);
    final scale = BigInt.from(1000000);
    final whole = v ~/ scale;
    final fraction = (v % scale).toString().padLeft(6, '0')
        .replaceFirst(RegExp(r'0+$'), '');
    return fraction.isEmpty ? '$whole' : '$whole.$fraction';
  }
}

abstract interface class MsnFundingTransport {
  Future<List<MsnFundingOperation>> read();
}

/// Reuses existing authenticated Dio. This never starts a checkout,
/// sends a conversion quote or trusts an HTTP redirect as settlement.
class GatewayMsnFundingTransport implements MsnFundingTransport {
  GatewayMsnFundingTransport({
    required Dio dio,
    required String baseUrl,
    required String? Function() readAccessToken,
  }) : _dio = dio,
       _baseUrl = baseUrl.replaceFirst(RegExp(r'/$'), ''),
       _readAccessToken = readAccessToken;

  final Dio _dio;
  final String _baseUrl;
  final String? Function() _readAccessToken;

  @override
  Future<List<MsnFundingOperation>> read() async {
    final token = _readAccessToken()?.trim();
    if (token == null || token.isEmpty) {
      throw const ApiException('Sign in to view MSN funding', statusCode: 401);
    }
    try {
      final result = await _dio.get<Map<String, dynamic>>(
        '$_baseUrl/v1/wallet/msn/funding',
        options: Options(
          followRedirects: false,
          receiveTimeout: const Duration(seconds: 12),
          headers: {'Authorization': 'Bearer $token'},
        ),
      );
      if (_readAccessToken()?.trim() != token) {
        throw const ApiException('MSN session changed', statusCode: 401);
      }
      final items = result.data?['items'];
      if (items is! List || items.length > 20) {
        throw const ApiException('Funding status is unavailable');
      }
      try {
        return List<MsnFundingOperation>.unmodifiable(items.map((item) {
          if (item is! Map<String, dynamic>) {
            throw const FormatException('Invalid MSN funding item');
          }
          return MsnFundingOperation.fromJson(item);
        }));
      } on FormatException {
        throw const ApiException('Funding status is unavailable');
      }
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        throw const ApiException('MSN funding is not available yet',
            statusCode: 404);
      }
      if (error.response?.statusCode == 401 ||
          error.response?.statusCode == 403) {
        throw const ApiException('Sign in again to view MSN funding',
            statusCode: 401);
      }
      throw mapDioError(error);
    }
  }
}
