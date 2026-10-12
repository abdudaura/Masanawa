import 'dart:async';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/widgets.dart';
import 'package:masanawa/src/agents/agent_shell.dart';
import 'package:masanawa/src/calls/group_call_audio.dart';
import 'package:masanawa/src/calls/group_call_controller.dart';
import 'package:masanawa/src/calls/group_call_transport.dart';

const contacts = [
  GroupContact(characterId: 'a', displayName: 'A', supportAgent: true),
  GroupContact(characterId: 'b', displayName: 'B', supportAgent: true),
];
MasanaCallGroup group([String state = 'connecting']) => MasanaCallGroup(
  groupId: 'g',
  state: state,
  createdAt: DateTime.utc(2026),
  participants: [
    for (final c in contacts)
      GroupParticipant(
        characterId: c.characterId,
        displayName: c.displayName,
        state: 'selected',
      ),
  ],
);
AgentLiveVoiceGrant grant(String id) => AgentLiveVoiceGrant(
  token: 'secret',
  websocketUrl: 'wss://example.invalid',
  model: 'model',
  voiceName: 'voice',
  expiresAt: DateTime.utc(2027),
  callId: id,
);

class Transport implements GroupCallTransport {
  final tokens = <String>[];
  int ends = 0;
  Completer<AgentLiveVoiceGrant>? pending;
  @override
  Future<MasanaCallGroup> create(String requestId, List<String> ids) async =>
      group();
  @override
  Future<MasanaCallGroup> load(String id) async => group();
  @override
  Future<AgentLiveVoiceGrant> token(
    String group,
    String id, {
    String? admissionId,
  }) async {
    tokens.add(id);
    if (id == 'b' && pending != null) return pending!.future;
    return grant(id);
  }

  @override
  Future<MasanaCallGroup> remove(String group, String id) async =>
      groupObject();
  MasanaCallGroup groupObject() => group();
  @override
  Future<MasanaCallGroup> end(String id) async {
    ends++;
    return group('ended');
  }
}

class Microphone implements GroupMicrophone {
  final input = StreamController<Uint8List>.broadcast(sync: true);
  int starts = 0, closes = 0;
  @override
  Future<Stream<Uint8List>> start(void Function() interrupt) async {
    starts++;
    return input.stream;
  }

  @override
  Future<void> close() async {
    closes++;
    await input.close();
  }
}

class Player implements GroupPcmPlayer {
  final writes = <int>[];
  int stops = 0;
  @override
  Future<void> write(Uint8List bytes) async {
    writes.add(bytes.first);
  }

  @override
  Future<void> stop() async {
    stops++;
  }
}

class Member implements GroupMemberSession {
  Member(this.input, this.closed);
  final Stream<Uint8List> input;
  final void Function() closed;
  final frames = <Uint8List>[];
  StreamSubscription<Uint8List>? subscription;
  bool didClose = false;
  @override
  Future<void> start() async {
    subscription = input.listen(frames.add);
  }

  @override
  Future<void> close() async {
    didClose = true;
    await subscription?.cancel();
    closed();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'one microphone fans human frames to all members and account end closes every session',
    () async {
      final mic = Microphone(), transport = Transport(), player = Player();
      final members = <Member>[];
      String? account = 'owner';
      final reports = <String>[];
      final controller = GroupCallController(
        accountKey: 'owner',
        currentAccountKey: () => account,
        transport: transport,
        contacts: contacts,
        microphone: mic,
        player: player,
        onChildConnected: (g) => reports.add('connected:${g.callId}'),
        onChildClosed: (g) => reports.add('ended:${g.callId}'),
        sessionFactory:
            ({
              required grant,
              required name,
              required microphone,
              required audio,
              required interrupted,
              required turnComplete,
              required closed,
            }) {
              final m = Member(microphone, closed);
              members.add(m);
              return m;
            },
      );
      await controller.start(['a', 'b']);
      expect(mic.starts, 1);
      expect(members.length, 2);
      mic.input.add(Uint8List.fromList([1, 2]));
      expect(members.map((m) => m.frames.length), [1, 1]);
      controller.setMuted(true);
      mic.input.add(Uint8List.fromList([3, 4]));
      expect(members.map((m) => m.frames.length), [1, 1]);
      account = 'other';
      await controller.accountChanged();
      expect(members.every((m) => m.didClose), isTrue);
      expect(mic.closes, 1);
      expect(transport.ends, 1);
      expect(reports, ['connected:a', 'connected:b', 'ended:a', 'ended:b']);
      controller.dispose();
    },
  );
  test(
    'unsupported paid voice and denied consent never request participant token',
    () async {
      for (final authorize in [null, (GroupContact _) async => null]) {
        final transport = Transport();
        final controller = GroupCallController(
          accountKey: 'owner',
          currentAccountKey: () => 'owner',
          transport: transport,
          contacts: const [
            GroupContact(characterId: 'a', displayName: 'A'),
            GroupContact(characterId: 'b', displayName: 'B'),
          ],
          microphone: Microphone(),
          player: Player(),
          authorize: authorize,
        );
        await controller.start(['a', 'b']);
        expect(transport.tokens, isEmpty);
        expect(controller.ended, isTrue);
        expect(
          controller.error,
          contains(authorize == null ? 'unavailable' : 'declined'),
        );
        controller.dispose();
      }
    },
  );
  test(
    'removal during token request cannot resurrect member and closes abandoned grant',
    () async {
      final transport = Transport()..pending = Completer();
      final members = <Member>[], ended = <String>[];
      final controller = GroupCallController(
        accountKey: 'owner',
        currentAccountKey: () => 'owner',
        transport: transport,
        contacts: contacts,
        microphone: Microphone(),
        player: Player(),
        onChildClosed: (g) => ended.add(g.callId!),
        sessionFactory:
            ({
              required grant,
              required name,
              required microphone,
              required audio,
              required interrupted,
              required turnComplete,
              required closed,
            }) {
              final m = Member(microphone, closed);
              members.add(m);
              return m;
            },
      );
      final starting = controller.start(['a', 'b']);
      await Future<void>.delayed(Duration.zero);
      expect(transport.tokens, ['a', 'b']);
      await controller.remove('b');
      transport.pending!.complete(grant('b'));
      await starting;
      expect(members.length, 1);
      expect(controller.memberStates['b'], 'left');
      expect(ended, contains('b'));
      await controller.end();
      controller.dispose();
    },
  );
  test('background terminates microphone and healthy sessions', () async {
    final mic = Microphone(), transport = Transport();
    final controller = GroupCallController(
      accountKey: 'o',
      currentAccountKey: () => 'o',
      transport: transport,
      contacts: contacts,
      microphone: mic,
      player: Player(),
      sessionFactory:
          ({
            required grant,
            required name,
            required microphone,
            required audio,
            required interrupted,
            required turnComplete,
            required closed,
          }) => Member(microphone, closed),
    );
    await controller.start(['a', 'b']);
    controller.didChangeAppLifecycleState(AppLifecycleState.paused);
    await controller.end();
    expect(mic.closes, 1);
    expect(controller.ended, isTrue);
    controller.dispose();
  });
  test(
    'PCM coordinator holds a turn, bounds pending audio and drops removed speaker',
    () async {
      final player = Player(), gates = <Completer<void>>[];
      final coordinator = GroupPlaybackCoordinator(
        player: player,
        onFailure: (error) => fail('$error'),
        maxQueuedBytes: 8,
        wait: (_) {
          final c = Completer<void>();
          gates.add(c);
          return c.future;
        },
      );
      coordinator.add('a', Uint8List.fromList([1, 0]));
      await Future<void>.delayed(Duration.zero);
      coordinator.add('b', Uint8List.fromList([2, 0]));
      coordinator.add('b', Uint8List.fromList(List.filled(10, 3)));
      expect(coordinator.queuedBytes, 2);
      expect(player.writes, [1]);
      gates.first.complete();
      await Future<void>.delayed(Duration.zero);
      expect(player.writes, [1]);
      coordinator.turnComplete('a');
      await Future<void>.delayed(Duration.zero);
      expect(player.writes, [1, 2]);
      await coordinator.remove('b');
      coordinator.add('b', Uint8List.fromList([4, 0]));
      expect(coordinator.queuedBytes, 0);
      gates.last.complete();
      await coordinator.close();
    },
  );
  test(
    'all consent finishes before microphone or participant provider start',
    () async {
      final second = Completer<GroupAdmission?>();
      final transport = Transport(), mic = Microphone();
      final controller = GroupCallController(
        accountKey: 'o',
        currentAccountKey: () => 'o',
        transport: transport,
        contacts: const [
          GroupContact(characterId: 'a', displayName: 'A'),
          GroupContact(characterId: 'b', displayName: 'B'),
        ],
        microphone: mic,
        player: Player(),
        authorize: (c) async => c.characterId == 'b'
            ? second.future
            : GroupAdmission(
                admissionId: 'a',
                onMediaStarted: () async {},
                onEnded: () async {},
              ),
        sessionFactory:
            ({
              required grant,
              required name,
              required microphone,
              required audio,
              required interrupted,
              required turnComplete,
              required closed,
            }) => Member(microphone, closed),
      );
      final starting = controller.start(['a', 'b']);
      await Future<void>.delayed(Duration.zero);
      expect(mic.starts, 0);
      expect(transport.tokens, isEmpty);
      second.complete(
        GroupAdmission(
          admissionId: 'b',
          onMediaStarted: () async {},
          onEnded: () async {},
        ),
      );
      await starting;
      expect(mic.starts, 1);
      expect(transport.tokens, ['a', 'b']);
      await controller.end();
      controller.dispose();
    },
  );
  test(
    'removal during billing callback never overwrites left or reports late connected',
    () async {
      final media = Completer<void>();
      final reports = <String>[];
      final transport = Transport();
      final controller = GroupCallController(
        accountKey: 'o',
        currentAccountKey: () => 'o',
        transport: transport,
        contacts: const [
          GroupContact(characterId: 'a', displayName: 'A'),
          GroupContact(characterId: 'b', displayName: 'B', supportAgent: true),
        ],
        microphone: Microphone(),
        player: Player(),
        authorize: (c) async => GroupAdmission(
          admissionId: 'a',
          onMediaStarted: () => media.future,
          onEnded: () async {},
        ),
        onChildConnected: (g) => reports.add(g.callId!),
        sessionFactory:
            ({
              required grant,
              required name,
              required microphone,
              required audio,
              required interrupted,
              required turnComplete,
              required closed,
            }) => Member(microphone, closed),
      );
      final starting = controller.start(['a', 'b']);
      await Future<void>.delayed(Duration.zero);
      expect(reports, ['a']);
      await controller.remove('a');
      media.complete();
      await starting;
      expect(controller.memberStates['a'], 'left');
      expect(reports, ['a', 'b']);
      await controller.end();
      controller.dispose();
    },
  );
  test(
    'audio ownership and all sockets close before delayed history or billing',
    () async {
      final history = Completer<void>(),
          mic = Microphone(),
          members = <Member>[];
      final controller = GroupCallController(
        accountKey: 'o',
        currentAccountKey: () => 'o',
        transport: Transport(),
        contacts: contacts,
        microphone: mic,
        player: Player(),
        onChildClosed: (_) => history.future,
        sessionFactory:
            ({
              required grant,
              required name,
              required microphone,
              required audio,
              required interrupted,
              required turnComplete,
              required closed,
            }) {
              final m = Member(microphone, closed);
              members.add(m);
              return m;
            },
      );
      await controller.start(['a', 'b']);
      final ending = controller.end();
      await Future<void>.delayed(Duration.zero);
      expect(mic.closes, 1);
      expect(members.every((m) => m.didClose), isTrue);
      history.complete();
      await ending;
      controller.dispose();
    },
  );
  test('paid participant ends at consented duration cap', () async {
    final controller = GroupCallController(
      accountKey: 'o',
      currentAccountKey: () => 'o',
      transport: Transport(),
      contacts: const [
        GroupContact(characterId: 'a', displayName: 'A'),
        GroupContact(characterId: 'b', displayName: 'B'),
      ],
      microphone: Microphone(),
      player: Player(),
      authorize: (c) async => GroupAdmission(
        admissionId: c.characterId,
        maxDuration: const Duration(milliseconds: 10),
        onMediaStarted: () async {},
        onEnded: () async {},
      ),
      sessionFactory:
          ({
            required grant,
            required name,
            required microphone,
            required audio,
            required interrupted,
            required turnComplete,
            required closed,
          }) => Member(microphone, closed),
    );
    await controller.start(['a', 'b']);
    await Future<void>.delayed(const Duration(milliseconds: 30));
    expect(controller.memberStates.values, everyElement('left'));
    expect(controller.ended, isTrue);
    await controller.end();
    controller.dispose();
  });
  test(
    'end during microphone setup never opens a participant session',
    () async {
      final microphone = _DeferredMicrophone(), transport = Transport();
      final controller = GroupCallController(
        accountKey: 'o',
        currentAccountKey: () => 'o',
        transport: transport,
        contacts: contacts,
        microphone: microphone,
        player: Player(),
      );
      final starting = controller.start(['a', 'b']);
      await Future<void>.delayed(Duration.zero);
      await controller.end();
      microphone.ready.complete(microphone.input.stream);
      await starting;
      expect(microphone.closes, 1);
      expect(transport.tokens, isEmpty);
      expect(controller.ended, isTrue);
      controller.dispose();
    },
  );
  test(
    'playback teardown failure still releases microphone and every session',
    () async {
      final mic = Microphone(), members = <Member>[];
      final controller = GroupCallController(
        accountKey: 'o',
        currentAccountKey: () => 'o',
        transport: Transport(),
        contacts: contacts,
        microphone: mic,
        player: _FailingStopPlayer(),
        sessionFactory:
            ({
              required grant,
              required name,
              required microphone,
              required audio,
              required interrupted,
              required turnComplete,
              required closed,
            }) {
              final m = Member(microphone, closed);
              members.add(m);
              return m;
            },
      );
      await controller.start(['a', 'b']);
      await controller.end();
      expect(mic.closes, 1);
      expect(members.every((m) => m.didClose), isTrue);
      controller.dispose();
    },
  );
  test(
    'late consent for removed participant immediately returns reservation without joining',
    () async {
      final late = Completer<GroupAdmission?>(), transport = Transport();
      final returned = <String>[];
      final controller = GroupCallController(
        accountKey: 'o',
        currentAccountKey: () => 'o',
        transport: transport,
        contacts: const [
          GroupContact(characterId: 'a', displayName: 'A'),
          GroupContact(characterId: 'b', displayName: 'B'),
        ],
        microphone: Microphone(),
        player: Player(),
        authorize: (c) async => c.characterId == 'b'
            ? late.future
            : GroupAdmission(
                admissionId: 'a',
                onMediaStarted: () async {},
                onEnded: () async {
                  returned.add('a');
                },
              ),
        sessionFactory:
            ({
              required grant,
              required name,
              required microphone,
              required audio,
              required interrupted,
              required turnComplete,
              required closed,
            }) => Member(microphone, closed),
      );
      final starting = controller.start(['a', 'b']);
      await Future<void>.delayed(Duration.zero);
      await controller.remove('b');
      late.complete(
        GroupAdmission(
          admissionId: 'b',
          onMediaStarted: () async {
            fail('Removed reservation started media');
          },
          onEnded: () async {
            returned.add('b');
          },
        ),
      );
      await starting;
      expect(returned, ['b']);
      expect(transport.tokens, ['a']);
      expect(controller.memberStates['b'], 'left');
      expect(controller.memberStates['a'], 'active');
      await controller.end();
      controller.dispose();
    },
  );
  test('absolute reservation expiry clamps a longer quoted duration', () async {
    final ended = <String>[];
    final controller = GroupCallController(
      accountKey: 'o',
      currentAccountKey: () => 'o',
      transport: Transport(),
      contacts: const [
        GroupContact(characterId: 'a', displayName: 'A'),
        GroupContact(characterId: 'b', displayName: 'B'),
      ],
      microphone: Microphone(),
      player: Player(),
      authorize: (c) async => GroupAdmission(
        admissionId: c.characterId,
        maxDuration: const Duration(minutes: 5),
        expiresAt: DateTime.now().add(const Duration(milliseconds: 15)),
        onMediaStarted: () async {},
        onEnded: () async {
          ended.add(c.characterId);
        },
      ),
      sessionFactory:
          ({
            required grant,
            required name,
            required microphone,
            required audio,
            required interrupted,
            required turnComplete,
            required closed,
          }) => Member(microphone, closed),
    );
    await controller.start(['a', 'b']);
    await Future<void>.delayed(const Duration(milliseconds: 35));
    await controller.end();
    expect(ended.toSet(), {'a', 'b'});
    expect(controller.memberStates.values, everyElement('left'));
    controller.dispose();
  });
}

class _DeferredMicrophone extends Microphone {
  final ready = Completer<Stream<Uint8List>>();
  @override
  Future<Stream<Uint8List>> start(void Function() interrupt) {
    starts++;
    return ready.future;
  }
}

class _FailingStopPlayer extends Player {
  @override
  Future<void> stop() async {
    throw StateError('native stop failed');
  }
}
