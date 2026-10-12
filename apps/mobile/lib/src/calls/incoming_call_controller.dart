import 'dart:async';

import 'package:flutter/widgets.dart';

import '../agents/agent_shell.dart';
import '../core/live_voice_session.dart';
import 'group_call_controller.dart';
import 'incoming_call_transport.dart';

typedef IncomingSessionFactory =
    LiveVoiceSession Function(
      AgentLiveVoiceGrant grant,
      IncomingCallRecord call,
      GroupAdmission admission,
      void Function() closed,
    );

class IncomingCallController extends ChangeNotifier
    with WidgetsBindingObserver {
  IncomingCallController({
    required this.callId,
    required this.accountKey,
    required this.currentAccountKey,
    required this.transport,
    required this.authorize,
    this.onConnected,
    this.onClosed,
    IncomingSessionFactory? sessionFactory,
    this.pollInterval = const Duration(seconds: 5),
  }) : _sessionFactory = sessionFactory ?? _nativeSession {
    WidgetsBinding.instance.addObserver(this);
    _poll = Timer.periodic(pollInterval, (_) {
      if (_foreground && !busy && !ended) unawaited(refresh());
    });
  }
  static LiveVoiceSession _nativeSession(
    AgentLiveVoiceGrant grant,
    IncomingCallRecord call,
    GroupAdmission admission,
    void Function() closed,
  ) => LiveVoiceSession(
    grant: grant,
    characterName: call.displayName,
    maxDuration: admission.remaining,
    endAt: admission.expiresAt,
    onClosed: closed,
  );
  final String callId, accountKey;
  final String? Function() currentAccountKey;
  final IncomingCallTransport transport;
  final Future<GroupAdmission?> Function(IncomingCallRecord) authorize;
  final Future<void> Function(AgentLiveVoiceGrant)? onConnected, onClosed;
  final IncomingSessionFactory _sessionFactory;
  final Duration pollInterval;
  Timer? _poll;
  IncomingCallRecord? call;
  LiveVoiceSession? _session;
  GroupAdmission? _admission;
  AgentLiveVoiceGrant? _grant;
  String? error;
  bool busy = false,
      ended = false,
      active = false,
      muted = false,
      _disposed = false,
      _loading = false;
  Future<void>? _ending;
  bool _foreground = true;
  bool get _valid => !_disposed && !ended && currentAccountKey() == accountKey;
  bool get canAccept =>
      _foreground &&
      _valid &&
      !busy &&
      call?.ringing == true &&
      call!.expiresAt.isAfter(DateTime.now());
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _check() {
    if (!_valid) throw StateError('This call ended or your account changed.');
  }

  Future<void> refresh() async {
    if (!_foreground || !_valid || _loading || busy) return;
    _loading = true;
    try {
      final value = await transport.load(callId);
      if (!_valid) return;
      // Once authoritative state leaves ringing, an old response cannot revive it.
      if (call != null && !call!.ringing && value.ringing) return;
      call = value;
      error = null;
      if (!value.ringing && value.state != 'accepted') await end();
    } catch (_) {
      if (_valid) {
        error = 'Could not check this call. Check your connection and retry.';
      }
    } finally {
      _loading = false;
      _notify();
    }
  }

  Future<void> accept() async {
    if (!canAccept) return;
    busy = true;
    error = null;
    _notify();
    try {
      // Acceptance is a server race decision; it never authorizes spending.
      final accepted = await transport.accept(callId);
      _check();
      call = accepted;
      if (accepted.state != 'accepted') {
        await end();
        return;
      }
      final admission = await authorize(accepted);
      if (admission != null) _admission = admission;
      if (!_valid) {
        await _cleanup();
        return;
      }
      if (admission == null) {
        await end();
        return;
      }
      if (admission.remaining <= Duration.zero) {
        throw StateError('Voice approval expired.');
      }
      final grant = await transport.token(
        callId,
        admissionId: admission.admissionId,
      );
      _grant = grant;
      if (!_valid) {
        await _cleanup();
        return;
      }
      final session = _sessionFactory(
        grant,
        accepted,
        admission,
        () => unawaited(end()),
      );
      _session = session;
      await session.start();
      await session.ready;
      _check();
      await onConnected?.call(grant);
      _check();
      await admission.onMediaStarted();
      _check();
      active = true;
    } catch (failure) {
      error = failure is StateError
          ? failure.message
          : 'Could not connect this call. Check Calls and Wallet activity.';
      await end();
    } finally {
      busy = false;
      _notify();
    }
  }

  Future<void> decline() async {
    if (!canAccept) return;
    busy = true;
    _notify();
    try {
      final value = await transport.decline(callId);
      if (_valid) {
        call = value;
        await end();
      }
    } catch (_) {
      if (_valid) error = 'Could not decline this call. Retry.';
    } finally {
      busy = false;
      _notify();
    }
  }

  Future<void> setMuted(bool value) async {
    await _session?.mute(value);
    muted = value;
    _notify();
  }

  Future<void> _cleanup() async {
    final session = _session;
    _session = null;
    final admission = _admission;
    _admission = null;
    final grant = _grant;
    _grant = null;
    try {
      await session?.close();
    } catch (_) {}
    try {
      if (grant != null) await onClosed?.call(grant);
    } catch (_) {}
    try {
      await admission?.onEnded();
    } catch (_) {
      error =
          'Call ended. Billing completion is pending; check Wallet activity.';
    }
  }

  Future<void> end() {
    if (_ending != null) return _ending!;
    ended = true;
    active = false;
    _poll?.cancel();
    _notify();
    return _ending = _cleanup();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (state == AppLifecycleState.resumed) {
      if (!ended) unawaited(refresh());
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      if (busy || _session != null) unawaited(end());
    }
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    unawaited(end());
    super.dispose();
  }
}
