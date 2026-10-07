import 'package:dio/dio.dart';

const adminGatewayBaseUrl = String.fromEnvironment('ADMIN_AUTH_BASE_URL');

class WhatsAppChannelStatus {
  const WhatsAppChannelStatus({
    required this.mode,
    required this.status,
    required this.connected,
    required this.phone,
    required this.lastEvent,
    required this.reconnectAttempt,
    required this.qrReady,
  });
  final String mode;
  final String status;
  final bool connected;
  final String? phone;
  final String lastEvent;
  final int reconnectAttempt;
  final bool qrReady;
  factory WhatsAppChannelStatus.fromJson(Map<String, dynamic> json) => WhatsAppChannelStatus(
    mode: json['mode'] as String? ?? 'linked-device',
    status: json['status'] as String? ?? 'offline',
    connected: json['connected'] as bool? ?? false,
    phone: json['phone'] as String?,
    lastEvent: json['lastEvent'] as String? ?? 'unknown',
    reconnectAttempt: json['reconnectAttempt'] as int? ?? 0,
    qrReady: json['qrReady'] as bool? ?? false,
  );
}

class WhatsAppQr {
  const WhatsAppQr({required this.dataUrl, required this.status});
  final String dataUrl;
  final String status;
  factory WhatsAppQr.fromJson(Map<String, dynamic> json) => WhatsAppQr(
    dataUrl: json['qrDataUrl'] as String,
    status: json['status'] as String? ?? 'qr',
  );
}

class WhatsAppChannelApi {
  WhatsAppChannelApi({required String token, required this.refreshAccessToken, Dio? dio})
      : _token = token,
        _dio = dio ?? Dio(BaseOptions(
          baseUrl: adminGatewayBaseUrl.trim(),
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 20),
          headers: {'Accept': 'application/json'},
        ));

  String _token;
  final Future<String?> Function() refreshAccessToken;
  final Dio _dio;

  Options get _auth => Options(
    headers: {'Authorization': 'Bearer $_token'},
    validateStatus: (status) => status != null && status < 500,
  );

  Future<Response<dynamic>> _request(Future<Response<dynamic>> Function() run) async {
    var response = await run();
    if (response.statusCode == 401) {
      final refreshed = await refreshAccessToken();
      if (refreshed != null && refreshed.trim().isNotEmpty) {
        _token = refreshed.trim();
        response = await run();
      }
    }
    if ((response.statusCode ?? 500) >= 400) {
      final data = response.data;
      String? code;
      if (data is Map) code = data['error']?.toString();
      if (code == 'qr_not_ready') {
        throw Exception('A pairing QR is not ready yet.');
      }
      throw Exception('WhatsApp channel request failed (' + (response.statusCode?.toString() ?? 'unknown') + ').');
    }
    return response;
  }

  Future<WhatsAppChannelStatus> status() async {
    final response = await _request(() => _dio.get<dynamic>('/admin/channels/whatsapp/status', options: _auth));
    return WhatsAppChannelStatus.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<WhatsAppQr> qr() async {
    final response = await _request(() => _dio.get<dynamic>('/admin/channels/whatsapp/qr', options: _auth));
    return WhatsAppQr.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<WhatsAppChannelStatus> reset() async {
    await _request(() => _dio.post<dynamic>('/admin/channels/whatsapp/reset', options: _auth));
    return status();
  }
}
