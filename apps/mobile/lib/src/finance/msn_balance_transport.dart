import 'package:dio/dio.dart';

import '../core/network/api_client.dart';

/// Exact authenticated MSN micro-units; never pass through double or a guessed
/// exchange rate. NGN is a funding rail, not a wallet balance.
class MsnBalance {
  const MsnBalance._(this.spendableMicro);

  final String spendableMicro;

  factory MsnBalance.fromJson(Map<String, dynamic> json) {
    final value = json['spendableMicro'];
    if (json['asset'] != 'MSN' ||
        value is! String ||
        !RegExp(r'^(0|[1-9][0-9]*)$').hasMatch(value)) {
      throw const FormatException('Invalid MSN balance response');
    }
    return MsnBalance._(value);
  }

  String get displayAmount {
    final micro = BigInt.parse(spendableMicro);
    final scale = BigInt.from(1000000);
    final whole = micro ~/ scale;
    final remainder = (micro % scale).toString().padLeft(6, '0');
    final fractional = remainder.replaceFirst(RegExp(r'0+$'), '');
    return fractional.isEmpty ? '$whole' : '$whole.$fractional';
  }
}

abstract interface class MsnBalanceTransport {
  Future<MsnBalance> read();
}

/// Uses the existing mobile account session. This is a read-only route;
/// provider callbacks and issuance are deliberately unavailable to clients.
class GatewayMsnBalanceTransport implements MsnBalanceTransport {
  GatewayMsnBalanceTransport({
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
  Future<MsnBalance> read() async {
    final token = _readAccessToken()?.trim();
    if (token == null || token.isEmpty) {
      throw const ApiException('Sign in to view MSN balance', statusCode: 401);
    }
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$_baseUrl/v1/wallet/msn',
        options: Options(
          followRedirects: false,
          receiveTimeout: const Duration(seconds: 12),
          headers: {'Authorization': 'Bearer $token'},
        ),
      );
      final value = response.data;
      if (value == null) {
        throw const ApiException('MSN balance is unavailable');
      }
      // The shared Dio client may rotate the bearer or switch users while
      // awaiting the response. Never accept a different principal's readback.
      if (_readAccessToken()?.trim() != token) {
        throw const ApiException('MSN session changed', statusCode: 401);
      }
      try {
        return MsnBalance.fromJson(value);
      } on FormatException {
        throw const ApiException('MSN balance response is unavailable');
      }
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        // The endpoint stays disabled until migration + composition qualify.
        throw const ApiException('MSN balance is not available yet',
            statusCode: 404);
      }
      if (error.response?.statusCode == 401 ||
          error.response?.statusCode == 403) {
        throw const ApiException('Sign in again to view MSN balance',
            statusCode: 401);
      }
      throw mapDioError(error);
    }
  }
}
