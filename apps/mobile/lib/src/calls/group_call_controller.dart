import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/widgets.dart';
import '../agents/agent_shell.dart';
import '../core/live_voice_session.dart';
import 'group_call_audio.dart';
import 'group_call_transport.dart';

class GroupAdmission {
  const GroupAdmission({
    required this.admissionId,
    required this.onMediaStarted,
    required this.onEnded,
    this.maxDuration = const Duration(minutes: 5),
    this.expiresAt,
  });
  final String admissionId;
  final Duration maxDuration;
  final DateTime? expiresAt;
  Duration get remaining {
    final untilExpiry = expiresAt?.difference(DateTime.now());
    return untilExpiry != null && untilExpiry < maxDuration
        ? untilExpiry
        : maxDuration;
  }

  final Future<void> Function() onMediaStarted, onEnded;
}

abstract interface class GroupMemberSession {
  Future<void> start();
  Future<void> close();
}

typedef GroupSessionFactory =
    GroupMemberSession Function({
      required AgentLiveVoiceGrant grant,
      required String name,
      required Stream<Uint8List> microphone,
      required void Function(Uint8List) audio,
      required void Function() interrupted,
      required void Function() turnComplete,
      required void Function() closed,
    });

class _NativeMember implements GroupMemberSession {
  _NativeMember({
    required AgentLiveVoiceGrant grant,
    required String name,
    required Stream<Uint8List> microphone,
    required void Function(Uint8List) audio,
    required void Function() interrupted,
    required void Function() turnComplete,
    required void Function() closed,
  }) : _session = LiveVoiceSession(
         grant: grant,
         characterName: name,
         sharedMicrophone: microphone,
         onAudioPcm: audio,
         onInterrupted: interrupted,
         onClosed: closed,
         sendGreeting: false,
       ) {
    _turns = _session.turnCompletions.listen((_) => turnComplete());
  }
  final LiveVoiceSession _session;
  late final StreamSubscription<void> _turns;
  @override
  Future<void> start() async {
    await _session.start();
    await _session.ready;
  }

  @override
  Future<void> close() async {
    await _turns.cancel();
    await _session.close();
  }
}

class GroupCallController extends ChangeNotifier with WidgetsBindingObserver {
  GroupCallController({
    required this.accountKey,
    required this.currentAccountKey,
    required this.transport,
    required this.contacts,
    GroupMicrophone? microphone,
    GroupPcmPlayer? player,
    GroupSessionFactory? sessionFactory,
    this.authorize,
    this.onChildConnected,
    this.onChildClosed,
  }) : _microphone = microphone ?? NativeGroupMicrophone(),
       _sessionFactory = sessionFactory ?? _NativeMember.new {
    _playback = GroupPlaybackCoordinator(
      player: player ?? NativeGroupPcmPlayer(),
      onFailure: (_) {
        error = 'Group audio stopped. Start a new call.';
        unawaited(end());
      },
    );
    WidgetsBinding.instance.addObserver(this);
  }
  final String accountKey;
  final String? Function() currentAccountKey;
  final GroupCallTransport transport;
  final List<GroupContact> contacts;
  final Future<GroupAdmission?> Function(GroupContact)? authorize;
  final FutureOr<void> Function(AgentLiveVoiceGrant)? onChildConnected,
      onChildClosed;
  final GroupMicrophone _microphone;
  final GroupSessionFactory _sessionFactory;
  late final GroupPlaybackCoordinator _playback;
  final Map<String, GroupMemberSession> _sessions = {};
  final Map<String, GroupAdmission> _admissions = {};
  final Map<String, Timer> _limits = {};
  final Map<String, AgentLiveVoiceGrant> _grants = {};
  final Set<String> _removed = {};
  final Map<String, String> memberStates = {};
  final StreamController<Uint8List> _input = StreamController.broadcast(
    sync: true,
  );
  StreamSubscription<Uint8List>? _capture;
  MasanaCallGroup? group;
  String? error;
  bool busy = false, ended = false, muted = false, _disposed = false;
  Future<void>? _ending;
  String? _requestId;
  List<String>? _selection;
  bool get _valid => !ended && currentAccountKey() == accountKey;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _check() {
    if (!_valid) {
      throw StateError('This call has ended or the signed-in account changed.');
    }
  }

  Future<void> start(List<String> ids) async {
    if (busy || group != null || ended) return;
    if (ids.length < 2 ||
        ids.length > 4 ||
        ids.toSet().length != ids.length ||
        ids.any((id) => !contacts.any((c) => c.characterId == id))) {
      error = 'Choose 2–4 current Masana contacts.';
      _notify();
      return;
    }
    if (_selection != null &&
        _selection!.join('\u0000') != ids.join('\u0000')) {
      error = 'Retry the original selection to recover this call.';
      _notify();
      return;
    }
    _selection = List.of(ids);
    _requestId ??= 'group-${DateTime.now().microsecondsSinceEpoch}';
    busy = true;
    error = null;
    _notify();
    try {
      _check();
      group = await transport.create(_requestId!, ids);
      if (!_valid) {
        await _endRemote();
        return;
      }
      if (group!.state == 'ended') {
        throw StateError('This group has already ended.');
      }
      final chosen = group!.participants;
      if (chosen
          .map((p) => p.characterId)
          .toSet()
          .difference(ids.toSet())
          .isNotEmpty) {
        throw StateError('Group membership changed. Start a new call.');
      }
      for (final participant in chosen) {
        if (!_valid) break;
        if (_removed.contains(participant.characterId)) continue;
        final contact = contacts.firstWhere(
          (c) => c.characterId == participant.characterId,
        );
        if (contact.supportAgent) continue;
        try {
          if (authorize == null) {
            throw StateError(
              'Paid group voice is unavailable. No charge was authorized.',
            );
          }
          final admission = await authorize!(contact);
          if (admission != null) _admissions[contact.characterId] = admission;
          if (_removed.contains(contact.characterId) || !_valid) {
            await _cleanup(contact.characterId);
            if (_removed.contains(contact.characterId)) continue;
            _check();
          }
          _check();
          if (admission == null) {
            throw StateError('Voice consent was declined.');
          }
          if (admission.remaining <= Duration.zero) {
            throw StateError('This voice admission has expired.');
          }
        } catch (failure) {
          if (!_removed.contains(contact.characterId) && !ended) {
            memberStates[contact.characterId] = 'failed';
          }
          error = failure is StateError
              ? failure.message
              : 'Paid voice could not be authorized.';
          await _cleanup(contact.characterId);
          _notify();
        }
      }
      _check();
      if (!chosen.any(
        (p) =>
            memberStates[p.characterId] != 'failed' &&
            !_removed.contains(p.characterId),
      )) {
        await end();
        return;
      }
      final stream = await _microphone.start(() => unawaited(end()));
      _check();
      _capture = stream.listen(
        (bytes) {
          if (_valid && !muted && !_input.isClosed) _input.add(bytes);
        },
        onError: (_) {
          error = 'Microphone streaming stopped.';
          unawaited(end());
        },
        onDone: () {
          if (_valid) unawaited(end());
        },
      );
      for (final participant in chosen) {
        if (!_valid) break;
        if (memberStates[participant.characterId] == 'failed' ||
            _removed.contains(participant.characterId)) {
          continue;
        }
        final contact = contacts.firstWhere(
          (c) => c.characterId == participant.characterId,
        );
        await _join(contact);
      }
      if (_valid && _sessions.isEmpty) {
        error ??= 'No Masana could join this call.';
        await end();
      }
    } catch (failure) {
      error = failure is StateError
          ? failure.message
          : 'Could not start the group call. Check your connection and retry.';
      // Creation failures can safely replay the same request key. Once audio
      // ownership or a group exists, ending is terminal.
      if (group != null) await end();
    } finally {
      busy = false;
      _notify();
    }
  }

  Future<void> _join(GroupContact contact) async {
    final id = contact.characterId;
    memberStates[id] = 'connecting';
    _notify();
    try {
      _check();
      if (_admissions[id] != null &&
          _admissions[id]!.remaining <= Duration.zero) {
        throw StateError('This voice admission has expired.');
      }
      final grant = await transport.token(
        group!.groupId,
        id,
        admissionId: _admissions[id]?.admissionId,
      );
      _grants[id] = grant;
      if (!_valid || _removed.contains(id)) {
        await _cleanup(id);
        return;
      }
      final session = _sessionFactory(
        grant: grant,
        name: contact.displayName,
        microphone: _input.stream,
        audio: (bytes) {
          if (_valid && !_removed.contains(id)) _playback.add(id, bytes);
        },
        interrupted: () => unawaited(_playback.interrupt(id)),
        turnComplete: () => _playback.turnComplete(id),
        closed: () {
          if (_valid && !_removed.contains(id)) unawaited(_failed(id));
        },
      );
      _sessions[id] = session;
      await session.start();
      if (!_valid ||
          _removed.contains(id) ||
          !identical(_sessions[id], session)) {
        await _cleanup(id);
        return;
      }
      final admission = _admissions[id];
      if (admission != null) {
        final duration = admission.remaining;
        if (duration <= Duration.zero) {
          throw StateError('This voice admission has expired.');
        }
        _limits[id] = Timer(duration, () => unawaited(remove(id)));
      }
      await onChildConnected?.call(grant);
      if (!_valid ||
          _removed.contains(id) ||
          !identical(_sessions[id], session)) {
        return;
      }
      if (admission != null) await admission.onMediaStarted();
      if (!_valid ||
          _removed.contains(id) ||
          !identical(_sessions[id], session)) {
        return;
      }
      memberStates[id] = 'active';
      _notify();
    } catch (failure) {
      if (!_removed.contains(id) && !ended) memberStates[id] = 'failed';
      error = failure is StateError
          ? failure.message
          : 'A Masana could not join. Paid admission may be unavailable; no free fallback was used.';
      await _cleanup(id);
      _notify();
    }
  }

  Future<void> _failed(String id) async {
    memberStates[id] = 'failed';
    await _cleanup(id);
    _notify();
    if (_sessions.isEmpty && !busy && _valid) await end();
  }

  Future<void> _cleanup(String id) async {
    _limits.remove(id)?.cancel();
    final session = _sessions.remove(id);
    final admission = _admissions.remove(id);
    final grant = _grants.remove(id);
    try {
      await _playback.remove(id);
    } catch (_) {}
    try {
      await session?.close().timeout(const Duration(seconds: 3));
    } catch (_) {}
    try {
      if (grant != null) await onChildClosed?.call(grant);
    } catch (_) {}
    try {
      await admission?.onEnded();
    } catch (_) {
      error =
          'Call ended; billing completion could not be confirmed. Check Wallet activity before starting another paid call.';
    }
  }

  Future<void> remove(String id) async {
    if (ended || _removed.contains(id)) return;
    _removed.add(id);
    memberStates[id] = 'left';
    _notify();
    await _cleanup(id);
    try {
      _check();
      await transport.remove(group!.groupId, id);
    } catch (_) {
      error =
          'Masana disconnected locally. Server removal could not be confirmed.';
    }
    if (_sessions.isEmpty && !busy && _valid) await end();
    _notify();
  }

  void setMuted(bool value) {
    muted = value;
    _notify();
  }

  Future<void> accountChanged() => end();
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      unawaited(end());
    }
  }

  Future<void> _endRemote() async {
    final current = group;
    if (current == null) return;
    try {
      group = await transport.end(current.groupId);
    } catch (_) {
      error ??= 'Call ended locally. Server end could not be confirmed.';
    }
  }

  Future<void> end() {
    if (_ending != null) return _ending!;
    ended = true;
    _notify();
    return _ending = _finish();
  }

  Future<void> _finish() async {
    WidgetsBinding.instance.removeObserver(this);
    // Audio ownership ends before any history or financial network request.
    try {
      await _capture?.cancel();
    } catch (_) {}
    try {
      await _playback.close();
    } catch (_) {}
    try {
      await _microphone.close();
    } catch (_) {}
    final ids = {..._sessions.keys, ..._admissions.keys, ..._grants.keys};
    await Future.wait(ids.map(_cleanup));
    if (!_input.isClosed) await _input.close();
    await _endRemote();
    _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(end());
    super.dispose();
  }
}
