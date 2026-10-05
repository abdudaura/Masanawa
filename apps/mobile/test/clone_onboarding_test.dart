import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import '../lib/src/agents/clone_onboarding.dart';
import '../lib/src/state/clone_onboarding_controller.dart';

const request = 'request_01900000-0000-7000-8000-000000000001';
CloneOnboardingView view(String? state, {int revision = 1}) =>
    CloneOnboardingView.fromJson({
      'prompt': 'Continue setup',
      'runtimeReadiness': 'not-verified',
      'setup': state == null
          ? null
          : {
              'revision': revision,
              'state': state,
              'profile': {
                'displayName': 'Amina',
                'biography': 'A personal clone',
                'languages': ['Hausa'],
                'personality': ['Helpful'],
                'expertise': ['General'],
              },
              'confirmationRequestId': state == 'confirmed' ? request : null,
              'confirmationPreviewRevision': state == 'confirmed' ? 2 : null,
              'result': null,
            },
    });

class FakeTransport implements CloneOnboardingTransport {
  CloneOnboardingView current = view(null);
  bool failRead = false, failConfirm = false;
  Completer<CloneOnboardingView>? pending;
  final requests = <String>[];
  int saves = 0, previews = 0;
  @override
  Future<CloneOnboardingView> read() async {
    if (failRead) throw StateError('private error');
    return pending == null ? current : pending!.future;
  }

  @override
  Future<CloneOnboardingView> save({
    required int? expectedRevision,
    required Map<String, dynamic> profile,
  }) async {
    saves++;
    return current = view('editing');
  }

  @override
  Future<CloneOnboardingView> preview(int expectedRevision) async {
    previews++;
    return current = view('preview', revision: 2);
  }

  @override
  Future<CloneOnboardingView> confirm({
    required int expectedPreviewRevision,
    required String requestId,
  }) async {
    requests.add(requestId);
    if (failConfirm) throw StateError('timeout');
    return current = view('confirmed', revision: 3);
  }

  @override
  Future<CloneOnboardingView> cancel(int expectedRevision) async =>
      current = view(null);
}

void main() {
  test('failed initial read blocks mutations and redacts error', () async {
    final transport = FakeTransport()..failRead = true;
    final controller = CloneOnboardingController(transport: transport);
    expect(await controller.reload(), false);
    expect(await controller.save({}), false);
    expect(controller.view, null);
    expect(transport.saves, 0);
    expect(controller.error, isNot(contains('private')));
    controller.dispose();
  });
  test('save and preview do not create a clone', () async {
    final transport = FakeTransport();
    final controller = CloneOnboardingController(
      transport: transport,
      requestId: () => request,
    );
    await controller.reload();
    await controller.save({'displayName': 'Amina'});
    await controller.preview();
    expect(transport.requests, isEmpty);
    expect(controller.view!.state, 'preview');
    controller.dispose();
  });
  test('ambiguous confirmation reloads and retries exact request', () async {
    final transport = FakeTransport()
      ..current = view('preview', revision: 2)
      ..failConfirm = true;
    var generated = 0;
    final controller = CloneOnboardingController(
      transport: transport,
      requestId: () {
        generated++;
        return request;
      },
    );
    await controller.reload();
    expect(await controller.confirm(), false);
    expect(await controller.confirm(), false);
    expect(transport.requests, [request]);
    await controller.reload();
    transport.failConfirm = false;
    await controller.confirm();
    expect(transport.requests, [request, request]);
    expect(generated, 1);
    controller.dispose();
  });
  test('new controller resumes persisted confirmation', () async {
    final transport = FakeTransport()..current = view('confirmed', revision: 3);
    final controller = CloneOnboardingController(
      transport: transport,
      requestId: () => throw StateError('must not generate'),
    );
    await controller.reload();
    await controller.confirm();
    expect(transport.requests, [request]);
    expect(await controller.save({}), false);
    expect(await controller.cancel(), false);
    controller.dispose();
  });
  test(
    'concurrent operation and disposed response cannot mutate account',
    () async {
      final transport = FakeTransport()
        ..pending = Completer<CloneOnboardingView>();
      final controller = CloneOnboardingController(transport: transport);
      final read = controller.reload();
      expect(await controller.reload(), false);
      controller.dispose();
      transport.pending!.complete(view('editing'));
      expect(await read, false);
      expect(controller.view, null);
    },
  );
  test('a different saved preview gets a new confirmation identity', () async {
    final transport = FakeTransport()
      ..current = view('preview', revision: 2)
      ..failConfirm = true;
    var generated = 0;
    final controller = CloneOnboardingController(
      transport: transport,
      requestId: () =>
          'request_01900000-0000-7000-8000-00000000000${++generated}',
    );
    await controller.reload();
    await controller.confirm();
    transport.current = view('preview', revision: 4);
    await controller.reload();
    await controller.confirm();
    expect(transport.requests.toSet().length, 2);
    controller.dispose();
  });
  test('cancellation clears profile and confirmation state', () async {
    final transport = FakeTransport()..current = view('preview', revision: 2);
    final controller = CloneOnboardingController(transport: transport);
    await controller.reload();
    expect(await controller.cancel(), true);
    expect(controller.view!.profile, null);
    expect(controller.view!.confirmationRequestId, null);
    controller.dispose();
  });
  test(
    'ready results require canonical identifiers and a boolean creation flag',
    () {
      Map<String, dynamic> response() => {
        'prompt': 'Open clone',
        'runtimeReadiness': 'not-verified',
        'setup': {
          'revision': 4,
          'state': 'ready',
          'profile': {
            'displayName': 'Amina',
            'biography': 'Personal clone',
            'languages': ['Hausa'],
            'personality': ['Helpful'],
            'expertise': ['General'],
          },
          'confirmationRequestId': request,
          'confirmationPreviewRevision': 2,
          'result': {
            'created': true,
            'displayName': 'Canonical name',
            'characterId': request.replaceFirst('request_', 'character_'),
            'characterVersionId': request.replaceFirst(
              'request_',
              'character-version_',
            ),
            'relationshipId': request.replaceFirst('request_', 'relationship_'),
          },
        },
      };
      expect(
        CloneOnboardingView.fromJson(response()).result!.displayName,
        'Canonical name',
      );
      for (final key in [
        'characterId',
        'characterVersionId',
        'relationshipId',
        'created',
      ]) {
        final json = response();
        (json['setup']['result'] as Map)[key] = 'invalid';
        expect(() => CloneOnboardingView.fromJson(json), throwsFormatException);
      }
    },
  );
  test('rejects unverified confirmation and incomplete preview', () {
    expect(() => view('confirmed', revision: 2), throwsFormatException);
    expect(isCloneConfirmationRequestId('request_ordinary'), false);
  });
}
