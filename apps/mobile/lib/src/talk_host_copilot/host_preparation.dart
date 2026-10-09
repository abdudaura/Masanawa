import 'package:dio/dio.dart';

import '../core/network/api_client.dart';

enum HostPreparationPhase { draft, publishing, published }

class HostPreparation {
  const HostPreparation({
    required this.prepId,
    required this.title,
    required this.topic,
    required this.questions,
    required this.revision,
    required this.phase,
    this.talkId,
  });

  final String prepId;
  final String title;
  final String topic;
  final List<String> questions;
  final int revision;
  final HostPreparationPhase phase;
  final String? talkId;

  factory HostPreparation.fromJson(Map<String, dynamic> json) {
    final id = json['prepId'];
    final title = json['title'];
    final topic = json['topic'];
    final revision = json['revision'];
    final phase = json['phase'];
    final rawQuestions = json['questions'];
    if (id is! String || title is! String || topic is! String ||
        revision is! int || rawQuestions is! List ||
        rawQuestions.any((entry) => entry is! String) ||
        !const ['draft', 'publishing', 'published'].contains(phase)) {
      throw const FormatException('Invalid host preparation response');
    }
    return HostPreparation(
      prepId: id,
      title: title,
      topic: topic,
      questions: List<String>.unmodifiable(rawQuestions.cast<String>()),
      revision: revision,
      phase: switch (phase) {
        'publishing' => HostPreparationPhase.publishing,
        'published' => HostPreparationPhase.published,
        _ => HostPreparationPhase.draft,
      },
      talkId: json['talkId'] as String?,
    );
  }
}

abstract interface class HostPreparationTransport {
  Future<List<HostPreparation>> list();
  Future<HostPreparation> create({
    required String title, required String topic, required List<String> questions,
  });
  Future<HostPreparation> read(String prepId);
  Future<HostPreparation> edit({
    required String prepId, required int revision,
    required String title, required String topic, required List<String> questions,
  });
  Future<HostPreparation> goLive(String prepId, int revision);
  Future<HostPreparation> verify(String prepId);
  Future<List<Map<String, dynamic>>> experts(String prepId);
  Future<Map<String, dynamic>> quoteExpert(String prepId, String personaId);
}

class GatewayHostPreparationTransport implements HostPreparationTransport {
  GatewayHostPreparationTransport(this.api);
  final ApiClient api;

  String _path(String id) =>
      '/v1/talk-host-preparations/${Uri.encodeComponent(id)}';

  HostPreparation _decode(dynamic data) {
    if (data is! Map) {
      throw const FormatException('Invalid host preparation response');
    }
    return HostPreparation.fromJson(Map<String, dynamic>.from(data));
  }

  @override
  Future<List<HostPreparation>> list() async {
    final response = await api.dio.get<dynamic>('/v1/talk-host-preparations');
    if (response.data is! List) throw const FormatException('Invalid host draft list');
    return [for (final item in response.data as List) _decode(item)];
  }

  @override
  Future<HostPreparation> create({
    required String title, required String topic, required List<String> questions,
  }) async {
    final response = await api.dio.post<dynamic>('/v1/talk-host-preparations',
      data: {'title': title, 'topic': topic, 'questions': questions});
    return _decode(response.data);
  }

  @override
  Future<HostPreparation> read(String prepId) async {
    final response = await api.dio.get<dynamic>(_path(prepId));
    return _decode(response.data);
  }

  @override
  Future<HostPreparation> edit({
    required String prepId, required int revision,
    required String title, required String topic, required List<String> questions,
  }) async {
    final response = await api.dio.put<dynamic>(_path(prepId),
      data: {'revision': revision, 'title': title, 'topic': topic,
        'questions': questions});
    return _decode(response.data);
  }

  @override
  Future<HostPreparation> goLive(String prepId, int revision) async {
    final response = await api.dio.post<dynamic>(
      '${_path(prepId)}/go-live',
      data: {'revision': revision, 'confirmGoLive': true},
    );
    return _decode(response.data);
  }

  @override
  Future<HostPreparation> verify(String prepId) async {
    final response = await api.dio.post<dynamic>(
      '${_path(prepId)}/verify', data: <String, dynamic>{});
    return _decode(response.data);
  }

  @override
  Future<List<Map<String, dynamic>>> experts(String prepId) async {
    final response = await api.dio.get<dynamic>('${_path(prepId)}/experts');
    if (response.data is! List) throw const FormatException('Invalid experts');
    return [
      for (final item in response.data as List)
        if (item is Map) Map<String, dynamic>.from(item)
    ];
  }

  @override
  Future<Map<String, dynamic>> quoteExpert(String prepId, String personaId) async {
    final response = await api.dio.post<dynamic>(
      '${_path(prepId)}/expert-quote', data: {'personaId': personaId});
    if (response.data is! Map) throw const FormatException('Invalid quote');
    return Map<String, dynamic>.from(response.data as Map);
  }
}

String hostPreparationError(Object error) {
  if (error is DioException) {
    final status = error.response?.statusCode;
    if (status == 401) return 'Please sign in again to continue.';
    if (status == 403 || status == 404) {
      return 'This preparation is unavailable for your account.';
    }
    if (status == 409) {
      return 'The draft changed or publication is uncertain. Check status before taking another action.';
    }
    return 'Could not contact Masanawa. Your last confirmed draft remains unchanged.';
  }
  return 'Could not complete the action. Refresh your preparation and try again.';
}
