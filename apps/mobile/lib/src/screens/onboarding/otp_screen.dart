import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../state/session_state.dart';
import '../../tokens/unigeria_tokens.dart';
import '../../ui/components/onboarding_scaffold.dart';
import '../../ui/components/primary_button.dart';

/// OTP entry (SCREEN-SPECS `phone-login` state list): 6-digit code, a live
/// resend countdown driven by the contract's `resendInSeconds`, and
/// lockout/rate-limit errors surfaced from the envelope.
class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key});

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  Timer? _timer;
  int _remaining = 0;

  @override
  void initState() {
    super.initState();
    // Start the cooldown immediately when the screen opens mid-flow (the
    // await state already exists; ref.listen only fires on later changes).
    final state = ref.read(sessionProvider);
    if (state is SessionAwaitingOtp) {
      _startCountdown(state.resendInSeconds);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  /// Runs a per-second countdown that re-enables resend at 0. Restarted on
  /// every code dispatch (including resend) with the fresh cooldown.
  void _startCountdown(int seconds) {
    _timer?.cancel();
    setState(() => _remaining = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      setState(() {
        _remaining -= 1;
        if (_remaining <= 0) {
          _remaining = 0;
          t.cancel();
        }
      });
    });
  }

  /// Channel + identifier for the current flow regardless of state, so a failed
  /// verify (SessionError keeps the retry context) can still resubmit/resend.
  ({OtpChannel? channel, String? identifier})? _retryContext(SessionState state) {
    return switch (state) {
      SessionAwaitingOtp(:final channel, :final identifier) =>
        (channel: channel, identifier: identifier),
      SessionVerifying(:final channel, :final identifier) =>
        (channel: channel, identifier: identifier),
      SessionError(:final channel, :final identifier) =>
        (channel: channel, identifier: identifier),
      _ => null,
    };
  }

  void _verify() {
    final digits = _code.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter the 6-digit verification code')),
      );
      return;
    }
    final state = ref.read(sessionProvider);
    final ctx = _retryContext(state);
    if (ctx == null || ctx.channel == null || ctx.identifier == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session expired. Please request a new code.')),
      );
      context.go('/phone-login');
      return;
    }
    ref.read(sessionProvider.notifier).verifyOtp(
          digits,
          phone: ctx.channel == OtpChannel.sms ? ctx.identifier : null,
          email: ctx.channel == OtpChannel.email ? ctx.identifier : null,
        );
  }

  void _resend(OtpChannel channel, String identifier) {
    ref.read(sessionProvider.notifier).sendOtp(
          phone: channel == OtpChannel.sms ? identifier : null,
          email: channel == OtpChannel.email ? identifier : null,
        );
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      if (next is SessionSignedIn) {
        context.go(next.user.isNewUser ? '/name' : '/chats');
      } else if (next is SessionNameRequired) {
        context.go('/name');
      } else if (next is SessionAwaitingOtp) {
        // A resend landed: restart the cooldown with the fresh value.
        _startCountdown(next.resendInSeconds);
      } else if (next is SessionError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.message),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    });

    final state = ref.watch(sessionProvider);
    final ctx = _retryContext(state);
    final identifier = ctx?.identifier ?? '';
    final verifying = state is SessionVerifying;
    final error = state is SessionError ? state : null;

    return OnboardingScaffold(
      title: 'Enter the code',
      subtitle: 'Sent to $identifier',
      canGoBack: true,
      backDestination: '/phone-login',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _code,
            autofocus: true,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            onChanged: (val) {
              final digits = val.replaceAll(RegExp(r'\D'), '');
              // Editing after a failed attempt clears the error back to
              // awaiting so the corrected code can be resubmitted (and the
              // resend cooldown stays intact).
              final current = ref.read(sessionProvider);
              if (current is SessionError &&
                  current.channel != null &&
                  current.identifier != null) {
                ref
                    .read(sessionProvider.notifier)
                    .clearVerifyError(
                      channel: current.channel!,
                      identifier: current.identifier!,
                      resendInSeconds: _remaining,
                    );
              }
              if (digits.length == 6) {
                _verify();
              }
            },
            style: TextStyle(
              fontSize: UnigeriaTokens.fontSize['2xl'],
              letterSpacing: 12,
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.onSurface,
            ),
            decoration: InputDecoration(
              counterText: '',
              hintText: '······',
              hintStyle: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                letterSpacing: 12,
              ),
              filled: true,
              fillColor: Theme.of(context).colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(UnigeriaTokens.radius['md']!),
              ),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(
              error.message,
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
                fontSize: UnigeriaTokens.fontSize['sm'],
              ),
            ),
          ],
          const SizedBox(height: 24),
          PrimaryButton(
            label: verifying ? 'Verifying…' : 'Verify',
            loading: verifying,
            onPressed: _verify,
          ),
          const SizedBox(height: 16),
          TextButton(
            // Resend stays available from a failed-verify state too (the
            // retry context carries the channel/identifier), gated only by the
            // live cooldown.
            onPressed: ctx == null || _remaining > 0
                ? null
                : () => _resend(ctx.channel!, ctx.identifier!),
            child: Text(
              _remaining > 0 ? 'Resend code in ${_remaining}s' : 'Resend code',
              style: TextStyle(
                color: _remaining > 0
                    ? Theme.of(context).colorScheme.onSurfaceVariant
                    : Theme.of(context).colorScheme.primary,
                fontSize: UnigeriaTokens.fontSize['md'],
              ),
            ),
          ),
        ],
      ),
    );
  }
}