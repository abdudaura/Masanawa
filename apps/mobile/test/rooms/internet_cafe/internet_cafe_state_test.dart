import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/rooms/internet_cafe/internet_cafe_models.dart';
import 'package:masanawa/src/rooms/internet_cafe/internet_cafe_state.dart';

void main() {
  InternetCafeRoomProjection projection({
    String continuation = 'Continue your last task',
  }) {
    final service = InternetCafeServiceOption(
      serviceId: 'job-application',
      label: 'Job application',
      description: 'Prepare an application.',
      family: InternetCafeServiceFamily.applications,
      intentId: 'skill.job-application.start',
      execution: InternetCafeExecutionBinding.skill(
        skillRef: 'skill:job-application',
      ),
      intake: const InternetCafeTaskIntake(
        title: 'Application details',
        submitLabel: 'Continue',
        fields: [
          InternetCafeIntakeField(
            fieldId: 'role',
            label: 'Role',
            kind: InternetCafeFieldKind.shortText,
            required: true,
          ),
        ],
      ),
    );

    return InternetCafeRoomProjection(
      roomId: 'internet-cafe',
      title: 'Internet Cafe',
      subtitle: 'Everyday digital services.',
      quickStarts: const [
        InternetCafeQuickStart(
          intentId: 'skill.job-application.start',
          label: 'Apply',
          serviceId: 'job-application',
        ),
      ],
      sections: [
        InternetCafeServiceSection(
          family: InternetCafeServiceFamily.applications,
          title: 'Applications',
          description: 'Application help',
          services: [service],
        ),
      ],
      activeSelection: const InternetCafeSelectionProjection(
        selectionId: 'stage',
        serviceId: 'job-application',
        title: 'Choose stage',
        options: [
          InternetCafeChoice(value: 'start', label: 'Start'),
          InternetCafeChoice(value: 'review', label: 'Review'),
        ],
      ),
      continuationLabel: continuation,
    );
  }

  test('loads projection through isolated transport seam', () async {
    final transport = _FakeTransport(projection());
    final controller = InternetCafeController(transport);

    await controller.load();

    expect(controller.state.projection?.roomId, 'internet-cafe');
    expect(controller.state.loading, isFalse);
    expect(controller.state.errorMessage, isNull);
    expect(transport.loadCalls, 1);
  });

  test('mutation replaces projection with server returned truth', () async {
    final initial = projection();
    final updated = projection(continuation: 'Continue updated task');
    final transport = _FakeTransport(initial)..nextProjection = updated;
    final controller = InternetCafeController(transport);

    await controller.load();
    final result = await controller.runQuickStart(initial.quickStarts.single);

    expect(result, isTrue);
    expect(controller.state.projection?.continuationLabel, 'Continue updated task');
    expect(transport.quickStartCalls, 1);
  });

  test('rejects forged quick start and service before transport dispatch', () async {
    final current = projection();
    final transport = _FakeTransport(current);
    final controller = InternetCafeController(transport);
    await controller.load();

    const forgedQuickStart = InternetCafeQuickStart(
      intentId: 'forged.intent',
      label: 'Forged',
      serviceId: 'job-application',
    );
    final quickResult = await controller.runQuickStart(forgedQuickStart);

    expect(quickResult, isFalse);
    expect(transport.quickStartCalls, 0);

    final forgedService = InternetCafeServiceOption(
      serviceId: 'job-application',
      label: 'Forged',
      description: 'Forged',
      family: InternetCafeServiceFamily.applications,
      intentId: 'forged.intent',
      execution: InternetCafeExecutionBinding.skill(
        skillRef: 'skill:job-application',
      ),
    );
    final serviceResult = await controller.selectService(forgedService);

    expect(serviceResult, isFalse);
    expect(transport.serviceCalls, 0);
    expect(
      controller.state.errorMessage,
      'This service changed. Refresh and try again.',
    );
  });

  test('rejects selection option that is not in current projection', () async {
    final current = projection();
    final transport = _FakeTransport(current);
    final controller = InternetCafeController(transport);
    await controller.load();

    final result = await controller.chooseSelectionOption(
      selection: current.activeSelection!,
      option: const InternetCafeChoice(
        value: 'forged',
        label: 'Forged',
      ),
    );

    expect(result, isFalse);
    expect(controller.state.errorMessage, 'That option is no longer available.');
    expect(transport.selectionCalls, 0);
  });

  test('rejects stale or forged intake before transport dispatch', () async {
    final current = projection();
    final transport = _FakeTransport(current);
    final controller = InternetCafeController(transport);
    await controller.load();

    const stale = InternetCafeIntakeSubmission(
      serviceId: 'job-application',
      intentId: 'different.intent',
      values: {'role': 'Designer'},
    );

    final staleResult = await controller.submitIntake(stale);

    expect(staleResult, isFalse);
    expect(
      controller.state.errorMessage,
      'This service changed. Refresh and try again.',
    );
    expect(transport.intakeCalls, 0);

    const invalid = InternetCafeIntakeSubmission(
      serviceId: 'job-application',
      intentId: 'skill.job-application.start',
      values: {'role': ''},
    );

    final invalidResult = await controller.submitIntake(invalid);

    expect(invalidResult, isFalse);
    expect(
      controller.state.errorMessage,
      'Please review the information for this service.',
    );
    expect(transport.intakeCalls, 0);
  });

  test('serializes mutations and prevents duplicate dispatch while submitting',
      () async {
    final current = projection();
    final transport = _FakeTransport(current);
    final blocker = Completer<InternetCafeRoomProjection>();
    transport.pendingQuickStart = blocker.future;
    final controller = InternetCafeController(transport);
    await controller.load();

    final first = controller.runQuickStart(current.quickStarts.single);
    await Future<void>.delayed(Duration.zero);

    final second = await controller.runQuickStart(current.quickStarts.single);

    expect(second, isFalse);
    expect(transport.quickStartCalls, 1);
    expect(controller.state.submitting, isTrue);

    blocker.complete(current);
    expect(await first, isTrue);
    expect(controller.state.submitting, isFalse);
  });

  test('surfaces transport failure without dropping last good projection', () async {
    final current = projection();
    final transport = _FakeTransport(current)..throwOnContinue = true;
    final controller = InternetCafeController(transport);
    await controller.load();

    final result = await controller.continueLastTask();

    expect(result, isFalse);
    expect(controller.state.projection, same(current));
    expect(
      controller.state.errorMessage,
      'Could not continue your last task.',
    );
  });
}

class _FakeTransport implements InternetCafeTransport {
  _FakeTransport(this.initialProjection);

  final InternetCafeRoomProjection initialProjection;
  InternetCafeRoomProjection? nextProjection;
  Future<InternetCafeRoomProjection>? pendingQuickStart;
  bool throwOnContinue = false;

  int loadCalls = 0;
  int quickStartCalls = 0;
  int serviceCalls = 0;
  int selectionCalls = 0;
  int intakeCalls = 0;

  InternetCafeRoomProjection get _result => nextProjection ?? initialProjection;

  @override
  Future<InternetCafeRoomProjection> loadRoom() async {
    loadCalls++;
    return initialProjection;
  }

  @override
  Future<InternetCafeRoomProjection> runQuickStart(
    InternetCafeQuickStart quickStart,
  ) async {
    quickStartCalls++;
    final pending = pendingQuickStart;
    if (pending != null) return pending;
    return _result;
  }

  @override
  Future<InternetCafeRoomProjection> selectService(
    InternetCafeServiceOption service,
  ) async {
    serviceCalls++;
    return _result;
  }

  @override
  Future<InternetCafeRoomProjection> chooseSelectionOption({
    required InternetCafeSelectionProjection selection,
    required InternetCafeChoice option,
  }) async {
    selectionCalls++;
    return _result;
  }

  @override
  Future<InternetCafeRoomProjection> submitIntake(
    InternetCafeIntakeSubmission submission,
  ) async {
    intakeCalls++;
    return _result;
  }

  @override
  Future<InternetCafeRoomProjection> continueLastTask() async {
    if (throwOnContinue) throw StateError('offline');
    return _result;
  }
}
