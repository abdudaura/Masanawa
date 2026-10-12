import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../state/session_state.dart';
import '../voice/paid_voice_state.dart';
import 'call_lifecycle_reporter.dart';
import 'group_call_controller.dart';
import 'group_paid_voice_transport.dart';
import 'group_paid_voice_outbox.dart';
import 'incoming_call_controller.dart';
import 'incoming_call_transport.dart';

class IncomingCallScreen extends ConsumerStatefulWidget {
  const IncomingCallScreen({
    super.key,
    required this.callId,
    this.controller,
    this.controllerFactory,
  });
  final String callId;
  final IncomingCallController? controller;
  final IncomingCallController Function(SessionSignedIn session)?
  controllerFactory;
  @override
  ConsumerState<IncomingCallScreen> createState() => _IncomingCallScreenState();
}

class _IncomingCallScreenState extends ConsumerState<IncomingCallScreen> {
  IncomingCallController? _controller;
  Object? _identity;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _initializeController();
  }

  void _initializeController() {
    if (_controller != null) return;
    final session = ref.read(sessionProvider);
    _identity = session is SessionSignedIn ? session.tokens : null;
    if (widget.controller == null && session is! SessionSignedIn) return;
    if (widget.controllerFactory != null && session is SessionSignedIn) {
      _controller = widget.controllerFactory!(session);
      _controller!.addListener(_refresh);
      unawaited(_controller!.refresh());
      return;
    }
    final container = ProviderScope.containerOf(context, listen: false);
    final reporter = widget.controller == null
        ? ref.read(callLifecycleReporterProvider)
        : null;
    final owner = reporter?.captureOwner();
    if (widget.controller != null) {
      _controller = widget.controller;
    } else if (owner != null) {
      String? currentAccount() {
        final session = container.read(sessionProvider);
        return session is SessionSignedIn &&
                session.tokens.accessToken == owner.accessToken
            ? session.user.id
            : null;
      }

      final api = ref.read(apiClientProvider);
      final paid = PaidVoiceController(
        GroupPaidVoiceTransport(
          api: api,
          accountKey: owner.accountId,
          currentAccountKey: currentAccount,
          accessToken: owner.accessToken,
          outbox: ref.read(groupPaidVoiceOutboxProvider),
        ),
      );
      final binding = reporter!.bind(owner, widget.callId);
      _controller = IncomingCallController(
        callId: widget.callId,
        accountKey: owner.accountId,
        currentAccountKey: currentAccount,
        transport: GatewayIncomingCallTransport(
          api: api,
          accountKey: owner.accountId,
          currentAccountKey: currentAccount,
          accessToken: owner.accessToken,
        ),
        onConnected: (_) => binding.connected(),
        onClosed: (_) => binding.closed(),
        authorize: (call) async {
          final quote = await paid.quote(characterId: call.characterId);
          if (quote == null) {
            throw StateError(
              'Could not get a voice price. No charge was authorized.',
            );
          }
          if (!mounted ||
              currentAccount() != owner.accountId ||
              _controller!.ended) {
            return null;
          }
          final approved = await showDialog<bool>(
            context: context,
            builder: (dialogContext) => AlertDialog(
              title: Text('Voice with ${call.displayName}'),
              content: Text(
                quote.isTrial
                    ? 'Your ${quote.trialDurationDays}-day voice trial covers this call.'
                    : 'Reserve up to ${quote.spendCapCredits} MSN for about 5 minutes. Final billing follows the voice reservation policy.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(false),
                  child: const Text('Not now'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(dialogContext).pop(true),
                  child: const Text('Approve voice'),
                ),
              ],
            ),
          );
          if (approved != true ||
              !mounted ||
              currentAccount() != owner.accountId ||
              _controller!.ended) {
            return null;
          }
          final admission = await paid.accept(characterId: call.characterId);
          if (admission == null) {
            throw StateError('Could not reserve this voice call.');
          }
          return GroupAdmission(
            admissionId: admission.admissionId,
            maxDuration: Duration(seconds: quote.estimatedSeconds),
            expiresAt: admission.expiresAt,
            onMediaStarted: () =>
                paid.mediaStarted(admissionId: admission.admissionId),
            onEnded: () => paid.complete(
              admissionId: admission.admissionId,
              outcome: 'interrupted',
            ),
          );
        },
      );
    }
    _controller?.addListener(_refresh);
    if (_controller != null) unawaited(_controller!.refresh());
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _controller?.removeListener(_refresh);
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      final identity = next is SessionSignedIn ? next.tokens : null;
      if (!identical(identity, _identity)) {
        _controller?.removeListener(_refresh);
        _controller?.dispose();
        _controller = null;
        _identity = identity;
        if (widget.controller == null) _initializeController();
        if (mounted) setState(() {});
      }
    });
    final controller = _controller;
    final call = controller?.call;
    return PopScope<Object?>(
      canPop: controller?.active != true && controller?.busy != true,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) {
          await controller?.end();
          if (context.mounted) Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Incoming Masana call')),
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.call, size: 64),
                  const SizedBox(height: 16),
                  Text(
                    call?.displayName ?? 'Masana',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  Text(
                    controller == null
                        ? 'Sign in to check this call.'
                        : controller.active
                        ? 'Connected'
                        : call == null
                        ? 'Checking this call…'
                        : controller.ended && call.state == 'accepted'
                        ? 'Call ended'
                        : {
                                'ringing': 'Incoming audio call',
                                'accepted': 'Call accepted',
                                'missed': 'Missed call',
                                'cancelled': 'Call cancelled',
                                'declined': 'Call declined',
                              }[call.state] ??
                              'Call ended',
                  ),
                  if (controller?.busy == true)
                    const CircularProgressIndicator(),
                  if (controller?.error != null)
                    Text(
                      controller!.error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  const SizedBox(height: 24),
                  if (controller?.canAccept == true)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        TextButton(
                          onPressed: controller!.decline,
                          child: const Text('Decline'),
                        ),
                        FilledButton(
                          onPressed: controller.accept,
                          child: const Text('Accept'),
                        ),
                      ],
                    ),
                  if (controller?.active == true)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          tooltip: controller!.muted
                              ? 'Unmute microphone'
                              : 'Mute microphone',
                          onPressed: () =>
                              controller.setMuted(!controller.muted),
                          icon: Icon(
                            controller.muted ? Icons.mic_off : Icons.mic,
                          ),
                        ),
                        FilledButton(
                          onPressed: controller.end,
                          child: const Text('End call'),
                        ),
                      ],
                    ),
                  if (controller != null &&
                      !controller.ended &&
                      !controller.busy &&
                      controller.error != null)
                    TextButton(
                      onPressed: controller.refresh,
                      child: const Text('Retry'),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
