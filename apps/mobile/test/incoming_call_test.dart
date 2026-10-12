import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/calls/incoming_call_controller.dart';
import 'package:masanawa/src/calls/incoming_call_transport.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
import 'package:masanawa/src/calls/group_call_controller.dart';
import 'package:masanawa/src/core/live_voice_session.dart';
import 'package:flutter/widgets.dart';

class FakeIncoming implements IncomingCallTransport {
  IncomingCallRecord value = IncomingCallRecord(
    callId: 'call',
    characterId: 'character_test',
    displayName: 'Masana',
    state: 'ringing',
    createdAt: DateTime.now(),
    expiresAt: DateTime.now().add(const Duration(minutes: 1)),
  );
  int accepts = 0, tokens = 0;
  Completer<IncomingCallRecord>? pending;
  @override
  Future<IncomingCallRecord> load(String id) async =>
      pending == null ? value : pending!.future;
  @override
  Future<List<IncomingCallRecord>> list() async => [value];
  @override
  Future<IncomingCallRecord> accept(String id) async {
    accepts++;
    return IncomingCallRecord(
      callId: value.callId,
      characterId: value.characterId,
      displayName: value.displayName,
      state: 'accepted',
      createdAt: value.createdAt,
      expiresAt: value.expiresAt,
    );
  }

  @override
  Future<IncomingCallRecord> decline(String id) async => value;
  @override
  Future<AgentLiveVoiceGrant> token(String id, {String? admissionId}) async {
    tokens++;
    throw StateError('unexpected media');
  }
}

class FakeSession extends LiveVoiceSession {
  FakeSession(AgentLiveVoiceGrant grant, {this.waitUntilReady})
    : super(
        grant: grant,
        characterName: 'Masana',
        sharedMicrophone: const Stream.empty(),
      );
  final Completer<void>? waitUntilReady;
  int starts = 0, closes = 0;
  @override
  Future<void> start() async {
    starts++;
  }

  @override
  Future<void> get ready => waitUntilReady?.future ?? Future.value();
  @override
  Future<void> close() async {
    closes++;
  }
}

class MediaIncoming extends FakeIncoming {
  @override
  Future<AgentLiveVoiceGrant> token(String id, {String? admissionId}) async {
    tokens++;
    expect(admissionId, 'admission');
    return AgentLiveVoiceGrant(
      token: 'memory-only',
      websocketUrl: 'wss://example.test',
      model: 'test',
      voiceName: 'voice',
      expiresAt: DateTime.now().add(const Duration(minutes: 1)),
      callId: id,
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('late account response is discarded', () async {
    var account = 'a';
    final transport = FakeIncoming()..pending = Completer();
    final controller = IncomingCallController(
      callId: 'call',
      accountKey: 'a',
      currentAccountKey: () => account,
      transport: transport,
      authorize: (_) async => null,
    );
    final loading = controller.refresh();
    account = 'b';
    transport.pending!.complete(transport.value);
    await loading;
    expect(controller.call, isNull);
    controller.dispose();
  });
  test(
    'explicit acceptance precedes consent; declined consent never issues token',
    () async {
      final transport = FakeIncoming();
      final controller = IncomingCallController(
        callId: 'call',
        accountKey: 'a',
        currentAccountKey: () => 'a',
        transport: transport,
        authorize: (_) async {
          expect(transport.accepts, 1);
          return null;
        },
      );
      await controller.refresh();
      expect(transport.accepts, 0);
      await controller.accept();
      expect(transport.accepts, 1);
      expect(transport.tokens, 0);
      expect(controller.ended, isTrue);
      controller.dispose();
    },
  );
  test('terminal server invitation cannot be accepted', () async {
    final transport = FakeIncoming();
    final old = transport.value;
    transport.value = IncomingCallRecord(
      callId: old.callId,
      characterId: old.characterId,
      displayName: old.displayName,
      state: 'missed',
      createdAt: old.createdAt,
      expiresAt: old.expiresAt,
    );
    final controller = IncomingCallController(
      callId: 'call',
      accountKey: 'a',
      currentAccountKey: () => 'a',
      transport: transport,
      authorize: (_) async => null,
    );
    await controller.refresh();
    await controller.accept();
    expect(transport.accepts, 0);
    controller.dispose();
  });
  test(
    'closing during paid reservation completes late admission without media',
    () async {
      final transport = FakeIncoming();
      final pending = Completer<GroupAdmission?>();
      var completions = 0;
      final controller = IncomingCallController(
        callId: 'call',
        accountKey: 'a',
        currentAccountKey: () => 'a',
        transport: transport,
        authorize: (_) => pending.future,
      );
      await controller.refresh();
      final accepting = controller.accept();
      await Future<void>.delayed(Duration.zero);
      await controller.end();
      pending.complete(
        GroupAdmission(
          admissionId: 'admission',
          onMediaStarted: () async => fail('media started'),
          onEnded: () async {
            completions++;
          },
        ),
      );
      await accepting;
      expect(completions, 1);
      expect(transport.tokens, 0);
      controller.dispose();
    },
  );
  test(
    'accepted media connects and cleanup completes reservation exactly once',
    () async {
      final transport = MediaIncoming();
      FakeSession? session;
      var starts = 0, completions = 0, reports = 0;
      final controller = IncomingCallController(
        callId: 'call',
        accountKey: 'a',
        currentAccountKey: () => 'a',
        transport: transport,
        authorize: (_) async => GroupAdmission(
          admissionId: 'admission',
          onMediaStarted: () async {
            starts++;
          },
          onEnded: () async {
            completions++;
          },
        ),
        onConnected: (_) async {
          reports++;
        },
        sessionFactory: (grant, call, admission, closed) =>
            session = FakeSession(grant),
      );
      await controller.refresh();
      await controller.accept();
      await controller.accept();
      expect(controller.active, isTrue);
      expect(transport.tokens, 1);
      expect(starts, 1);
      expect(reports, 1);
      await controller.end();
      await controller.end();
      expect(session!.closes, 1);
      expect(completions, 1);
      controller.dispose();
    },
  );
  test(
    'background during media readiness closes audio without starting billing',
    () async {
      final transport = MediaIncoming();
      final ready = Completer<void>();
      FakeSession? session;
      var starts = 0, completions = 0;
      final controller = IncomingCallController(
        callId: 'call',
        accountKey: 'a',
        currentAccountKey: () => 'a',
        transport: transport,
        authorize: (_) async => GroupAdmission(
          admissionId: 'admission',
          onMediaStarted: () async {
            starts++;
          },
          onEnded: () async {
            completions++;
          },
        ),
        sessionFactory: (grant, call, admission, closed) =>
            session = FakeSession(grant, waitUntilReady: ready),
      );
      await controller.refresh();
      final accepting = controller.accept();
      await Future<void>.delayed(Duration.zero);
      controller.didChangeAppLifecycleState(AppLifecycleState.paused);
      ready.complete();
      await accepting;
      expect(starts, 0);
      expect(completions, 1);
      expect(session!.closes, 1);
      controller.dispose();
    },
  );
}
