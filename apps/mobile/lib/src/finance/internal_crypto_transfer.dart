import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/network/api_client.dart';
import '../core/request_id.dart';

class InternalCryptoTransferQuote {
  const InternalCryptoTransferQuote({
    required this.requestId, required this.recipientLabel,
    required this.asset, required this.network, required this.amount,
    required this.fee, required this.status, required this.expiresAt,
    required this.completedAt, this.confirmationToken,
  });
  final String requestId;
  final String recipientLabel;
  final String asset;
  final String? network;
  final String amount;
  final String fee;
  final String status;
  final DateTime expiresAt;
  final DateTime? completedAt;
  final String? confirmationToken;

  factory InternalCryptoTransferQuote.fromJson(Map<String, dynamic> json) {
    String field(String name) {
      final v = json[name];
      if (v is! String || v.isEmpty) throw FormatException('Invalid $name');
      return v;
    }
    final amount = field('amount');
    final fee = field('fee');
    if (!RegExp(r'^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,18})?$').hasMatch(amount) ||
        !RegExp(r'^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,18})?$').hasMatch(fee)) {
      throw const FormatException('Invalid server transfer amount');
    }
    final status = field('status');
    if (!const {'quoted','completed','expired','rejected'}.contains(status)) {
      throw const FormatException('Unknown crypto transfer status');
    }
    final token = json['confirmationToken'];
    if (token != null && (token is! String || !RegExp(r'^[0-9a-f]{64}$').hasMatch(token))) {
      throw const FormatException('Invalid transfer confirmation token');
    }
    return InternalCryptoTransferQuote(
      requestId: field('requestId'), recipientLabel: field('recipientLabel'),
      asset: field('asset'), network: json['network'] as String?,
      amount: amount, fee: fee, status: status,
      expiresAt: DateTime.parse(field('expiresAt')),
      completedAt: json['completedAt'] == null
        ? null : DateTime.parse(json['completedAt'] as String),
      confirmationToken: token as String?,
    );
  }
  bool get completed => status == 'completed';
  bool get expired => status == 'expired' ||
      (status == 'quoted' && !DateTime.now().toUtc().isBefore(expiresAt.toUtc()));
}

abstract interface class InternalCryptoTransferTransport {
  Future<InternalCryptoTransferQuote> quote({
    required String requestId, required String recipient,
    required String providerCode, required String amount,
  });
  Future<InternalCryptoTransferQuote?> read(String requestId);
  Future<InternalCryptoTransferQuote> confirm(String requestId, String confirmationToken);
}

class GatewayInternalCryptoTransferTransport implements InternalCryptoTransferTransport {
  GatewayInternalCryptoTransferTransport({required this.dio, required this.baseUrl});
  final Dio dio;
  final String baseUrl;
  String get _base => '${baseUrl.replaceFirst(RegExp(r'/$'), '')}/v1/financial/crypto/internal-transfers';
  @override
  Future<InternalCryptoTransferQuote> quote({
    required String requestId, required String recipient,
    required String providerCode, required String amount,
  }) async {
    final response = await dio.post<Map<String,dynamic>>('$_base/quotes', data:{
      'requestId':requestId, 'recipient':recipient,
      'providerCode':providerCode, 'amount':amount,
    }, options: Options(followRedirects:false));
    return InternalCryptoTransferQuote.fromJson(response.data ??
      (throw const ApiException('Empty transfer quote response')));
  }
  @override
  Future<InternalCryptoTransferQuote?> read(String requestId) async {
    try {
      final response=await dio.get<Map<String,dynamic>>('$_base/${Uri.encodeComponent(requestId)}',
        options:Options(followRedirects:false));
      return InternalCryptoTransferQuote.fromJson(response.data ??
        (throw const ApiException('Missing transfer status')));
    } on DioException catch(e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }
  @override
  Future<InternalCryptoTransferQuote> confirm(String requestId, String confirmationToken) async {
    final response=await dio.post<Map<String,dynamic>>(
      '$_base/${Uri.encodeComponent(requestId)}/confirm',
      data:{'confirmationToken':confirmationToken},
      options:Options(followRedirects:false));
    return InternalCryptoTransferQuote.fromJson(response.data ??
      (throw const ApiException('Missing transfer confirmation')));
  }
}

/// A crash-safe outbound reference only; no consent secret or auth token is
/// persisted. Each owner receives a distinct encrypted Android key.
class InternalCryptoTransferJournal {
  InternalCryptoTransferJournal({FlutterSecureStorage? store}):
      _store=store ?? const FlutterSecureStorage(aOptions:AndroidOptions());
  final FlutterSecureStorage _store;
  String _key(String ownerId) => 'internal_crypto_transfer_$ownerId';
  Future<String?> pendingRequest(String ownerId) => _store.read(key:_key(ownerId));
  Future<String> begin(String ownerId) async {
    final existing=await pendingRequest(ownerId);
    if(existing != null) return existing;
    final id=createRequestId();
    await _store.write(key:_key(ownerId),value:id);
    return id;
  }
  Future<void> clear(String ownerId) => _store.delete(key:_key(ownerId));
}
