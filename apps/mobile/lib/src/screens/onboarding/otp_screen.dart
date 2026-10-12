import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../localization/auth_error_localizer.dart';
import '../../localization/language_picker_button.dart';
import '../../localization/international_digits.dart';
import '../../localization/bidi_display.dart';
import '../../core/api/models.dart';
import '../../state/session_state.dart';
import '../../tokens/masanawa_tokens.dart';
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
  final _boxes =
      List<TextEditingController>.generate(6, (_) => TextEditingController());
  final _boxFocus = List<FocusNode>.generate(6, (_) => FocusNode());
  final _boxPrevLen = List<int>.filled(6, 0);
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
    for (final c in _boxes) {
      c.dispose();
    }
    for (final f in _boxFocus) {
      f.dispose();
    }
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

  /// One box changed: spread pastes, step forward on entry, step back on
  /// backspace, then keep the joined code plus the existing error-clear and
  /// auto-verify behavior.
  void _onBoxChanged(int i) {
    var value = _boxes[i].text;
    if (value.length > 1) {
      final digits = value.replaceAll(RegExp(r'\D'), '').split('');
      var k = i;
      for (final d in digits) {
        if (k > 5) break;
        _boxes[k].text = d;
        _boxPrevLen[k] = 1;
        k++;
      }
      _boxFocus[min(k, 5)].requestFocus();
    } else if (value.isEmpty && _boxPrevLen[i] > 0) {
      if (i > 0) {
        _boxFocus[i - 1].requestFocus();
        _boxes[i - 1].selection = TextSelection.collapsed(
          offset: _boxes[i - 1].text.length,
        );
      }
    } else if (value.isNotEmpty) {
      if (i < 5) _boxFocus[i + 1].requestFocus();
    }
    _boxPrevLen[i] = _boxes[i].text.length;
    _code.text = _boxes.map((b) => b.text).join();
    // Editing after a failed attempt clears the error back to
    // awaiting so the corrected code can be resubmitted (and the
    // resend cooldown stays intact).
    final current = ref.read(sessionProvider);
    if (current is SessionError &&
        current.channel != null &&
        current.identifier != null) {
      ref.read(sessionProvider.notifier).clearVerifyError(
            channel: current.channel!,
            identifier: current.identifier!,
            resendInSeconds: _remaining,
          );
    }
    if (_code.text.length == 6) {
      _verify();
    }
  }

  void _verify() {
    final digits = normalizeInternationalDigits(_code.text).replaceAll(RegExp(r'\D'), '');
    if (digits.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context).invalidOtpCode)),
      );
      return;
    }
    final state = ref.read(sessionProvider);
    final ctx = _retryContext(state);
    if (ctx == null || ctx.channel == null || ctx.identifier == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context).otpSessionExpired)),
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
        context.go('/chats');
      } else if (next is SessionNameRequired) {
        context.go('/name');
      } else if (next is SessionPasswordRequired) {
        context.go(
          '/password?phone=${Uri.encodeComponent(next.identifier)}'
          '&setup=${next.setup ? '1' : '0'}',
        );
      } else if (next is SessionAwaitingOtp) {
        // A resend landed: restart the cooldown with the fresh value.
        _startCountdown(next.resendInSeconds);
      } else if (next is SessionError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AuthErrorLocalizer.message(
              AppLocalizations.of(context),
              code: next.code,
              stage: AuthFailureStage.verifyCode,
            )),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    });

    final l10n = AppLocalizations.of(context);
    final state = ref.watch(sessionProvider);
    final ctx = _retryContext(state);
    final identifier = ctx?.identifier ?? '';
    final verifying = state is SessionVerifying;
    final error = state is SessionError ? state : null;

    return OnboardingScaffold(
      showLogo: false,
      title: l10n.otpTitle,
      subtitle: l10n.otpSentTo(
        BidiDisplay.identifier(
          identifier,
          surroundingDirection: Directionality.of(context),
        ),
      ),
      canGoBack: true,
      backDestination: '/phone-login',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: Alignment.center,
            child: LanguagePickerButton(),
          ),
          const SizedBox(height: 8),
          LayoutBuilder(
            builder: (context, constraints) {
              // Size six code boxes to the padded form so that the 320px
              // viewport and increased text sizes do not clip an input.
              final boxWidth = ((constraints.maxWidth - 30) / 6)
                  .clamp(36.0, 47.0)
                  .toDouble();
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  for (var i = 0; i < 6; i++)
                    SizedBox(
                      width: boxWidth,
                  child: TextField(
                    controller: _boxes[i],
                    focusNode: _boxFocus[i],
                    autofocus: i == 0,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    // No length limiter: multi-char input is a paste and is
                    // spread across boxes by _onBoxChanged.
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    onChanged: (_) => _onBoxChanged(i),
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                    decoration: InputDecoration(
                      counterText: '',
                      filled: true,
                      fillColor: Theme.of(context).colorScheme.surface,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(
                          MasanawaTokens.radius['md']!,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
              );
            },
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(
              AuthErrorLocalizer.message(
                l10n,
                code: error.code,
                stage: AuthFailureStage.verifyCode,
              ),
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
                fontSize: MasanawaTokens.fontSize['sm'],
              ),
            ),
          ],
          const SizedBox(height: 24),
          PrimaryButton(
            label: verifying ? l10n.verifyingCode : l10n.verifyCode,
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
              _remaining > 0 ? l10n.resendCodeIn(_remaining) : l10n.resendCode,
              style: TextStyle(
                color: _remaining > 0
                    ? Theme.of(context).colorScheme.onSurfaceVariant
                    : Theme.of(context).colorScheme.primary,
                fontSize: MasanawaTokens.fontSize['md'],
              ),
            ),
          ),
        ],
      ),
    );
  }
}