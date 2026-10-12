import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/providers.dart';
import '../core/mobile_push.dart';
import '../core/shell_deep_link.dart';
import '../state/session_state.dart';
import 'incoming_call_transport.dart';

/// Polling complements push delivery. Invitations are metadata; opening one
/// always rechecks the server and requires explicit acceptance and voice consent.
class IncomingCallCoordinator extends ConsumerStatefulWidget {
  const IncomingCallCoordinator({
    super.key,
    required this.child,
    this.transportFactory,
  });
  final Widget child;
  final IncomingCallTransport Function(
    SessionSignedIn session,
    String? Function() currentAccount,
  )?
  transportFactory;
  @override
  ConsumerState<IncomingCallCoordinator> createState() =>
      _IncomingCallCoordinatorState();
}

class _IncomingCallCoordinatorState
    extends ConsumerState<IncomingCallCoordinator>
    with WidgetsBindingObserver {
  Timer? _timer;
  StreamSubscription<Uri>? _hints;
  IncomingCallRecord? _call;
  Object? _identity;
  bool _loading = false, _foreground = true;
  int _generation = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _hints = MobilePushService.instance.incomingHints.listen(
      (_) => unawaited(_refresh()),
    );
    _timer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_refresh()),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_refresh()));
  }

  Future<void> _refresh() async {
    if (!mounted || _loading || !_foreground) return;
    final session = ref.read(sessionProvider);
    if (session is! SessionSignedIn) return;
    final generation = _generation;
    final identity = session.tokens;
    _loading = true;
    String? account() {
      if (!mounted) return null;
      final current = ref.read(sessionProvider);
      return current is SessionSignedIn && identical(current.tokens, identity)
          ? current.user.id
          : null;
    }

    try {
      final transport =
          widget.transportFactory?.call(session, account) ??
          GatewayIncomingCallTransport(
            api: ref.read(apiClientProvider),
            accountKey: session.user.id,
            currentAccountKey: account,
            accessToken: session.tokens.accessToken,
          );
      final calls = await transport.list();
      if (!mounted || generation != _generation || account() == null) return;
      final ringing = calls.where((call) => call.ringing).toList()
        ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
      setState(() => _call = ringing.isEmpty ? null : ringing.first);
    } catch (_) {
      /* Keep the last hint; opening it rechecks authority. */
    } finally {
      if (generation == _generation) _loading = false;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _foreground = state == AppLifecycleState.resumed;
    if (_foreground) unawaited(_refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    unawaited(_hints?.cancel());
    _generation++;
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (_, next) {
      final identity = next is SessionSignedIn ? next.tokens : null;
      if (!identical(identity, _identity)) {
        _identity = identity;
        _generation++;
        _loading = false;
        setState(() => _call = null);
        unawaited(_refresh());
      }
    });
    final call = _call;
    return Column(
      children: [
        if (call != null)
          SafeArea(
            bottom: false,
            child: Material(
              color: Theme.of(context).colorScheme.secondaryContainer,
              child: ListTile(
                leading: const Icon(Icons.call),
                title: Text('Incoming call from ${call.displayName}'),
                trailing: TextButton(
                  onPressed: () {
                    final router = GoRouter.of(context);
                    final target =
                        '/calls/incoming/${Uri.encodeComponent(call.callId)}';
                    if (canOpenIncomingCallRoute(
                      currentPath:
                          router.routeInformationProvider.value.uri.path,
                      targetPath: target,
                      hasActiveCall:
                          router.routerDelegate.navigatorKey.currentState
                              ?.canPop() ??
                          false,
                    )) {
                      unawaited(router.push<void>(target));
                    }
                  },
                  child: const Text('Open'),
                ),
              ),
            ),
          ),
        Expanded(child: widget.child),
      ],
    );
  }
}
