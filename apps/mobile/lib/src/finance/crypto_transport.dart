import 'package:dio/dio.dart';

import '../core/network/api_client.dart';
import 'crypto_models.dart';

abstract interface class CryptoWalletTransport {
  Future<CryptoCapabilities> capabilities();
  Future<List<CryptoRoute>> depositRoutes();
  Future<List<CryptoRoute>> conversionRoutes();
  Future<CryptoBalance> balance(String providerCode);
  Future<List<CryptoIntent>> history({int limit = 50});
  Future<CryptoIntent?> intent(String requestId);

  Future<CryptoIntent> createDeposit({
    required String requestId,
    required String providerCode,
    required String amount,
  });

  Future<CryptoFiatPurchase> createFiatPurchase({
    required String requestId,
    required String fiatAmount,
    required String fiatCurrency,
  });

  Future<CryptoFiatPurchase> refreshFiatPurchase(String requestId);

  Future<CryptoWithdrawalQuote> quoteWithdrawal({
    required String providerCode,
    required String amount,
    required String destinationAddress,
  });

  Future<CryptoIntent> createWithdrawal({
    required String requestId,
    required String providerCode,
    required String amount,
    required String destinationAddress,
  });

  Future<CryptoIntent> refreshWithdrawal(String requestId);

  Future<CryptoConversionQuote> quoteConversion({
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  });

  Future<CryptoIntent> createConversion({
    required String requestId,
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  });

  Future<CryptoIntent> refreshConversion(String requestId);
}

class MasanawaCryptoWalletTransport implements CryptoWalletTransport {
  MasanawaCryptoWalletTransport({
    required Dio dio,
    required String baseUrl,
    String? Function()? readAccessToken,
  })  : _dio = dio,
        _baseUrl = baseUrl.replaceFirst(RegExp(r'/$'), ''),
        _readAccessToken = readAccessToken;

  final Dio _dio;
  final String _baseUrl;
  final String? Function()? _readAccessToken;

  Options _options() {
    final token = _readAccessToken?.call()?.trim();
    return Options(
      followRedirects: false,
      headers: {
        if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
      },
    );
  }

  Future<Map<String, dynamic>> _get(String path) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$_baseUrl$path',
        options: _options(),
      );
      final data = response.data;
      if (data == null) {
        throw const ApiException('Empty response from server');
      }
      return data;
    } on DioException catch (error) {
      throw mapDioError(error);
    }
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '$_baseUrl$path',
        data: body,
        options: _options(),
      );
      final data = response.data;
      if (data == null) {
        throw const ApiException('Empty response from server');
      }
      return data;
    } on DioException catch (error) {
      throw mapDioError(error);
    }
  }

  List<CryptoRoute> _routes(Map<String, dynamic> data) {
    final raw = data['routes'];
    if (raw is! List) {
      throw const ApiException('Crypto routes are unavailable');
    }
    return List.unmodifiable([
      for (final item in raw)
        if (item is Map)
          CryptoRoute.fromJson(item.cast<String, dynamic>()),
    ]);
  }

  @override
  Future<CryptoCapabilities> capabilities() async {
    return CryptoCapabilities.fromJson(
      await _get('/v1/financial/capabilities'),
    );
  }

  @override
  Future<List<CryptoRoute>> depositRoutes() async {
    return _routes(await _get('/v1/financial/crypto/routes'));
  }

  @override
  Future<List<CryptoRoute>> conversionRoutes() async {
    return _routes(
      await _get('/v1/financial/crypto/conversion-routes'),
    );
  }

  @override
  Future<CryptoBalance> balance(String providerCode) async {
    final code = Uri.encodeComponent(providerCode.trim());
    if (code.isEmpty) throw const FormatException('Missing crypto asset');
    return CryptoBalance.fromJson(
      await _get('/v1/financial/crypto/balances/$code'),
    );
  }

  @override
  Future<List<CryptoIntent>> history({int limit = 50}) async {
    if (limit < 1 || limit > 100) {
      throw RangeError.range(limit, 1, 100, 'limit');
    }
    final data = await _get('/v1/financial/crypto/history?limit=$limit');
    final raw = data['intents'];
    if (raw is! List) {
      throw const ApiException('Crypto history is unavailable');
    }
    return List.unmodifiable([
      for (final item in raw)
        if (item is Map)
          CryptoIntent.fromJson(item.cast<String, dynamic>()),
    ]);
  }

  @override
  Future<CryptoIntent?> intent(String requestId) async {
    final id = Uri.encodeComponent(requestId.trim());
    if (id.isEmpty) throw const FormatException('Missing request id');
    try {
      return CryptoIntent.fromJson(
        await _get('/v1/financial/crypto/intents/$id'),
      );
    } on ApiException catch (error) {
      if (error.statusCode == 404) return null;
      rethrow;
    }
  }

  @override
  Future<CryptoIntent> createDeposit({
    required String requestId,
    required String providerCode,
    required String amount,
  }) async {
    return CryptoIntent.fromJson(
      await _post('/v1/financial/crypto/deposits', {
        'requestId': requestId,
        'providerCode': providerCode,
        'amount': amount,
      }),
    );
  }

  @override
  Future<CryptoFiatPurchase> createFiatPurchase({
    required String requestId,
    required String fiatAmount,
    required String fiatCurrency,
  }) async {
    return CryptoFiatPurchase.fromJson(
      await _post('/v1/financial/crypto/purchases', {
        'requestId': requestId,
        'fiatAmount': fiatAmount,
        'fiatCurrency': fiatCurrency,
      }),
    );
  }

  @override
  Future<CryptoFiatPurchase> refreshFiatPurchase(String requestId) async {
    final id = Uri.encodeComponent(requestId.trim());
    if (id.isEmpty) throw const FormatException('Missing request id');
    return CryptoFiatPurchase.fromJson(
      await _post(
        '/v1/financial/crypto/purchases/$id/refresh',
        const {},
      ),
    );
  }

  @override
  Future<CryptoWithdrawalQuote> quoteWithdrawal({
    required String providerCode,
    required String amount,
    required String destinationAddress,
  }) async {
    return CryptoWithdrawalQuote.fromJson(
      await _post('/v1/financial/crypto/withdrawals/quote', {
        'providerCode': providerCode,
        'amount': amount,
        'destinationAddress': destinationAddress,
      }),
    );
  }

  @override
  Future<CryptoIntent> createWithdrawal({
    required String requestId,
    required String providerCode,
    required String amount,
    required String destinationAddress,
  }) async {
    return CryptoIntent.fromJson(
      await _post('/v1/financial/crypto/withdrawals', {
        'requestId': requestId,
        'providerCode': providerCode,
        'amount': amount,
        'destinationAddress': destinationAddress,
      }),
    );
  }

  @override
  Future<CryptoIntent> refreshWithdrawal(String requestId) async {
    final id = Uri.encodeComponent(requestId.trim());
    if (id.isEmpty) throw const FormatException('Missing request id');
    return CryptoIntent.fromJson(
      await _post(
        '/v1/financial/crypto/withdrawals/$id/refresh',
        const {},
      ),
    );
  }

  @override
  Future<CryptoConversionQuote> quoteConversion({
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  }) async {
    return CryptoConversionQuote.fromJson(
      await _post('/v1/financial/crypto/conversions/quote', {
        'providerCode': providerCode,
        'targetProviderCode': targetProviderCode,
        'amount': amount,
      }),
    );
  }

  @override
  Future<CryptoIntent> createConversion({
    required String requestId,
    required String providerCode,
    required String targetProviderCode,
    required String amount,
  }) async {
    return CryptoIntent.fromJson(
      await _post('/v1/financial/crypto/conversions', {
        'requestId': requestId,
        'providerCode': providerCode,
        'targetProviderCode': targetProviderCode,
        'amount': amount,
      }),
    );
  }

  @override
  Future<CryptoIntent> refreshConversion(String requestId) async {
    final id = Uri.encodeComponent(requestId.trim());
    if (id.isEmpty) throw const FormatException('Missing request id');
    return CryptoIntent.fromJson(
      await _post(
        '/v1/financial/crypto/conversions/$id/refresh',
        const {},
      ),
    );
  }
}
