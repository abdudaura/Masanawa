import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

class InternalCryptoRoute {
  const InternalCryptoRoute(this.providerCode, this.asset, this.network);
  final String providerCode;
  final String asset;
  final String? network;

  factory InternalCryptoRoute.fromJson(Map<String, dynamic> json) {
    final code = json['providerCode'];
    final asset = json['asset'];
    final network = json['network'];
    if (code is! String || code.isEmpty || asset is! String || asset.isEmpty ||
        (network != null && network is! String)) {
      throw const FormatException('Invalid internal crypto route');
    }
    return InternalCryptoRoute(code, asset, network as String?);
  }

  String get label => network == null ? asset : '$asset · $network';
}

class InternalCryptoAvailability {
  const InternalCryptoAvailability({
    required this.enabled, required this.reason, required this.routes,
  });
  final bool enabled;
  final String? reason;
  final List<InternalCryptoRoute> routes;

  factory InternalCryptoAvailability.fromJson(Map<String, dynamic> json) {
    final raw = json['routes'];
    if (json['enabled'] is! bool || raw is! List ||
        (json['reason'] != null && json['reason'] is! String)) {
      throw const FormatException('Invalid transfer availability');
    }
    return InternalCryptoAvailability(
      enabled: json['enabled'] as bool,
      reason: json['reason'] as String?,
      routes: List.unmodifiable(raw.map((value) =>
        InternalCryptoRoute.fromJson((value as Map).cast<String, dynamic>()))),
    );
  }
}

class InternalCryptoQuote {
  const InternalCryptoQuote({
    required this.quoteId, required this.senderUserId,
    required this.recipientUserId, required this.asset, required this.network,
    required this.amount, required this.fee, required this.expiresAt,
  });
  final String quoteId;
  final String senderUserId;
  final String recipientUserId;
  final String asset;
  final String? network;
  final String amount;
  final String fee;
  final DateTime expiresAt;

  factory InternalCryptoQuote.fromJson(Map<String, dynamic> json) {
    final id = json['quoteId'];
    final sender = json['senderUserId'];
    final recipient = json['recipientUserId'];
    final asset = json['asset'];
    final amount = json['amount'];
    final fee = json['fee'];
    final expiresAt = DateTime.tryParse((json['expiresAt'] ?? '').toString());
    if (id is! String || id.isEmpty || sender is! String || sender.isEmpty ||
        recipient is! String || recipient.isEmpty || asset is! String ||
        asset.isEmpty || amount is! String || amount.isEmpty ||
        fee != '0' || expiresAt == null ||
        (json['network'] != null && json['network'] is! String)) {
      throw const FormatException('Invalid transfer quote');
    }
    return InternalCryptoQuote(
      quoteId: id, senderUserId: sender, recipientUserId: recipient,
      asset: asset, network: json['network'] as String?,
      amount: amount, fee: fee, expiresAt: expiresAt,
    );
  }
}

class InternalCryptoReceipt {
  const InternalCryptoReceipt({
    required this.transferId, required this.requestId, required this.senderUserId,
    required this.recipientUserId, required this.asset, required this.network,
    required this.amount, required this.completedAt,
  });
  final String transferId;
  final String requestId;
  final String senderUserId;
  final String recipientUserId;
  final String asset;
  final String? network;
  final String amount;
  final DateTime completedAt;

  factory InternalCryptoReceipt.fromJson(Map<String, dynamic> json) {
    if (json['status'] != 'completed' ||
        json['kind'] != 'internal-book-transfer' || json['fee'] != '0') {
      throw const FormatException('Unrecognized transfer settlement');
    }
    String field(String key) {
      final value = json[key];
      if (value is! String || value.isEmpty) {
        throw FormatException('Invalid transfer $key');
      }
      return value;
    }
    final date = DateTime.tryParse(field('completedAt'));
    if (date == null || (json['network'] != null && json['network'] is! String)) {
      throw const FormatException('Invalid transfer date or network');
    }
    return InternalCryptoReceipt(
      transferId: field('transferId'), requestId: field('requestId'),
      senderUserId: field('senderUserId'), recipientUserId: field('recipientUserId'),
      asset: field('asset'), network: json['network'] as String?,
      amount: field('amount'), completedAt: date,
    );
  }
}

class InternalCryptoTransferTransport {
  InternalCryptoTransferTransport({required Dio dio, required String baseUrl})
      : _dio = dio, _baseUrl = baseUrl.replaceFirst(RegExp(r'/$'), '');
  final Dio _dio;
  final String _baseUrl;
  static const _path = '/v1/financial/crypto/internal';

  Future<Map<String, dynamic>> _read(String suffix) async {
    try {
      final result = await _dio.get<Map<String, dynamic>>(
        '$_baseUrl$_path$suffix', options: Options(followRedirects: false),
      );
      if (result.data == null) throw const ApiException('Empty transfer response');
      return result.data!;
    } on DioException catch (e) { throw mapDioError(e); }
  }
  Future<Map<String, dynamic>> _write(String suffix, Map<String, dynamic> data) async {
    try {
      final result = await _dio.post<Map<String, dynamic>>(
        '$_baseUrl$_path$suffix', data: data, options: Options(followRedirects: false),
      );
      if (result.data == null) throw const ApiException('Empty transfer response');
      return result.data!;
    } on DioException catch (e) { throw mapDioError(e); }
  }
  Future<InternalCryptoAvailability> capabilities() async =>
    InternalCryptoAvailability.fromJson(await _read('/capabilities'));

  Future<InternalCryptoQuote> quote({
    required String quoteRequestId, required String recipientUserId,
    required String providerCode, required String amount,
  }) async => InternalCryptoQuote.fromJson(await _write('/quotes', {
    'quoteRequestId': quoteRequestId, 'recipientUserId': recipientUserId,
    'providerCode': providerCode, 'amount': amount,
  }));

  Future<InternalCryptoReceipt> transfer({
    required String requestId, required String quoteId,
  }) async => InternalCryptoReceipt.fromJson(await _write('/transfers', {
    'requestId': requestId, 'quoteId': quoteId, 'confirmed': true,
  }));

  Future<InternalCryptoReceipt?> byRequest(String requestId) async {
    try {
      return InternalCryptoReceipt.fromJson(
        await _read('/requests/${Uri.encodeComponent(requestId)}'));
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }
  Future<List<InternalCryptoReceipt>> history() async {
    final raw = (await _read('/history?limit=50'))['transfers'];
    if (raw is! List) throw const FormatException('Invalid internal transfer history');
    return List.unmodifiable(raw.map((e) =>
      InternalCryptoReceipt.fromJson((e as Map).cast<String, dynamic>())));
  }
}
