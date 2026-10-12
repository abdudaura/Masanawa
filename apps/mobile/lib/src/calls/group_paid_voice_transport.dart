import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../voice/paid_voice.dart';
import 'group_paid_voice_outbox.dart';

/// Canonical paid voice endpoints with immutable account credentials. Cleanup
/// may finish the old account's reservation, but never uses the new bearer.
class GroupPaidVoiceTransport implements PaidVoiceTransport {
  GroupPaidVoiceTransport({
    required ApiClient api,
    required this.accountKey,
    required this.currentAccountKey,
    this.outbox,
    String? accessToken,
    HttpClientAdapter? adapter,
  }) : _dio = Dio(
         BaseOptions(
           baseUrl: api.dio.options.baseUrl,
           headers: {
             'Authorization': 'Bearer ${accessToken ?? api.accessToken ?? ''}',
           },
           connectTimeout: const Duration(seconds: 15),
           receiveTimeout: const Duration(seconds: 20),
           sendTimeout: const Duration(seconds: 15),
           followRedirects: false,
         ),
       ) {
    if (adapter != null) _dio.httpClientAdapter = adapter;
  }
  final Dio _dio;
  final GroupPaidVoiceOutbox? outbox;
  final String accountKey;
  final String? Function() currentAccountKey;
  final Set<String> _admissions = {};
  void _check() {
    if (accountKey.isEmpty || currentAccountKey() != accountKey) {
      throw StateError('The signed-in account changed.');
    }
  }

  Future<dynamic> _post(String path, Map<String, dynamic> body) async {
    try {
      return (await _dio.post<dynamic>(path, data: body)).data;
    } on DioException catch (error) {
      throw mapDioError(error);
    }
  }

  Map<String, dynamic> _map(dynamic value) {
    if (value is! Map) {
      throw const FormatException('Invalid paid voice response');
    }
    return value.cast<String, dynamic>();
  }

  @override
  Future<PaidVoiceQuote> quote({
    required String characterId,
    required int expectedSeconds,
  }) async {
    _check();
    final result = await _post('/agent/twin/voice/quote', {
      'characterId': characterId,
      'expectedSeconds': expectedSeconds,
    });
    _check();
    final quote = PaidVoiceQuote.fromJson(_map(result));
    if (quote.characterId != characterId) {
      throw const FormatException('Voice quote belongs to a different Masana');
    }
    return quote;
  }

  @override
  Future<PaidVoiceAdmission> start({
    required String characterId,
    required String quoteId,
  }) async {
    _check();
    if (outbox == null) {
      throw StateError('Paid voice reconciliation is unavailable.');
    }
    await outbox!.prepareStart(accountKey, characterId, quoteId);
    dynamic result;
    try {
      _check();
      result = await _post('/agent/twin/voice/start', {
        'characterId': characterId,
        'quoteId': quoteId,
        'accepted': true,
      });
    } catch (_) {
      await outbox!.abandonStart(accountKey, quoteId);
      rethrow;
    }
    late final PaidVoiceAdmission admission;
    try {
      admission = PaidVoiceAdmission.fromJson(_map(result));
      if (admission.characterId != characterId ||
          admission.quoteId != quoteId) {
        throw const FormatException('Voice admission does not match consent');
      }
    } catch (_) {
      await outbox!.abandonStart(accountKey, quoteId);
      rethrow;
    }
    _admissions.add(admission.admissionId);
    try {
      if (outbox == null) {
        throw StateError('Paid group reconciliation is unavailable.');
      }
      await outbox!.register(
        accountKey,
        admission.admissionId,
        quoteId: quoteId,
      );
    } catch (_) {
      // Without durable storage media must not begin. Best-effort return the
      // just-created reservation using its immutable original credential.
      try {
        await _post(
          '/agent/twin/voice/${Uri.encodeComponent(admission.admissionId)}/complete',
          {'outcome': 'interrupted'},
        );
      } catch (_) {}
      await outbox!.abandonStart(accountKey, quoteId);
      rethrow;
    }
    if (currentAccountKey() != accountKey) {
      await complete(
        admissionId: admission.admissionId,
        outcome: 'interrupted',
      );
      _check();
    }
    return admission;
  }

  @override
  Future<void> mediaStarted({required String admissionId}) async {
    _check();
    if (!_admissions.contains(admissionId)) {
      throw StateError('Unknown voice admission.');
    }
    await _post(
      '/agent/twin/voice/${Uri.encodeComponent(admissionId)}/media-started',
      {},
    );
    _check();
  }

  @override
  Future<void> complete({
    required String admissionId,
    required String outcome,
  }) async {
    if (!_admissions.contains(admissionId)) {
      throw StateError('Unknown voice admission.');
    }
    if (outbox == null) {
      throw StateError('Paid group reconciliation is unavailable.');
    }
    await outbox!.complete(accountKey, admissionId, outcome);
    _admissions.remove(admissionId);
  }
}
