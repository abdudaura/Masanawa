import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa_admin/src/core/admin_api.dart';
import 'package:masanawa_admin/src/operator_admin/operator_agent_api.dart';

Map<String, dynamic> catalog() => {
  'schemaVersion': 1,
  'agents': [
    {
      'characterId': 'character_abc', 'characterVersionId': 'version_abc',
      'displayName': 'Gwani', 'roleLabel': 'Support', 'visibleInUserApp': true,
      'presentationRevision': 8, 'assignmentRevision': 3,
      'skillVersionIds': ['skill_abc'], 'unknownSkillVersionIds': [],
    },
  ],
  'skills': [
    {'skillVersionId': 'skill_abc', 'displayName': 'Learning',
      'version': '2', 'readiness': 'ready', 'advertised': true},
  ],
  'readAt': '2026-10-08T19:00:00Z',
};

void main() {
  test('authenticated catalog parses real version/assignment, no optimistic values', () async {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      expect(options.path, '/v1/admin/operator/agents');
      expect(options.headers['Authorization'], 'Bearer access');
      expect(options.headers['Cache-Control'], 'no-store');
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: catalog()));
    }));
    final repository = OperatorAgentApi(
      admin: AdminApi(token: 'access', dio: Dio()), dio: dio);
    final snapshot = await repository.snapshot();
    expect(snapshot.agents.single.assignmentRevision, 3);
    expect(snapshot.agents.single.version, 'version_abc');
    expect(snapshot.skills.single.name, 'Learning');
  });

  test('remove requires strong CAS If-Match and authoritative response', () async {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      expect(options.method, 'DELETE');
      expect(options.path, '/v1/admin/operator/agents/character_abc/skills/skill_abc');
      expect(options.headers['If-Match'], '"3"');
      expect(options.headers['Authorization'], 'Bearer access');
      handler.resolve(Response(requestOptions: options, statusCode: 200,
        data: {'characterId': 'character_abc', 'revision': 4, 'skillVersionIds': []}));
    }));
    final repository = OperatorAgentApi(
      admin: AdminApi(token: 'access', dio: Dio()), dio: dio);
    await repository.detachSkill(
      characterId: 'character_abc', skillVersionId: 'skill_abc', expectedRevision: 3);
  });

  test('unconfirmed write does not report success', () async {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      handler.resolve(Response(requestOptions: options, statusCode: 200,
        data: {'characterId': 'character_abc', 'revision': 3,
          'skillVersionIds': ['skill_abc']}));
    }));
    final repository = OperatorAgentApi(
      admin: AdminApi(token: 'access', dio: Dio()), dio: dio);
    await expectLater(repository.detachSkill(
      characterId: 'character_abc', skillVersionId: 'skill_abc',
      expectedRevision: 3), throwsA(isA<OperatorAgentException>()));
  });

  test('403 never returns protected catalog data', () async {
    final dio = Dio();
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      handler.reject(DioException(
        requestOptions: options, type: DioExceptionType.badResponse,
        response: Response(requestOptions: options, statusCode: 403,
          data: {'code': 'DENIED', 'internalDetail': 'do-not-leak'}),
      ));
    }));
    final repository = OperatorAgentApi(
      admin: AdminApi(token: 'access', dio: Dio()), dio: dio);
    await expectLater(repository.snapshot(),
      throwsA(isA<OperatorAgentException>().having((e) => e.code, 'code', 'DENIED')));
  });
}
