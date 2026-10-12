import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../localization/auth_error_localizer.dart';
import '../../localization/language_picker_button.dart';
import '../../state/session_state.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../ui/components/onboarding_scaffold.dart';
import '../../ui/components/primary_button.dart';

/// 6-digit device password gate for phone login (U-auth-pw).
///
/// [setup] true creates a password for an unregistered number (then the
/// profile step finishes registration); false enters the password of a
/// registered number on a new device. Email keeps real OTP and never lands
/// here. Nothing is bypassed: every path ends in a server call.
class PasswordScreen extends ConsumerStatefulWidget {
  const PasswordScreen({super.key, required this.phone, required this.setup});

  final String phone;
  final bool setup;

  @override
  ConsumerState<PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends ConsumerState<PasswordScreen> {
  final _boxes =
      List<TextEditingController>.generate(6, (_) => TextEditingController());
  final _boxFocus = List<FocusNode>.generate(6, (_) => FocusNode());
  final _boxPrevLen = List<int>.filled(6, 0);
  bool _busy = false;
  bool _confirming = false;
  String? _first;
  String? _localError;

  @override
  void dispose() {
    for (final c in _boxes) {
      c.dispose();
    }
    for (final f in _boxFocus) {
      f.dispose();
    }
    super.dispose();
  }

  String get _joined => _boxes.map((b) => b.text).join();

  void _clearBoxes() {
    for (var k = 0; k < 6; k++) {
      _boxes[k].text = '';
      _boxPrevLen[k] = 0;
    }
    _boxFocus[0].requestFocus();
  }

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
      if (k > 5) {
        _boxFocus[5].unfocus();
      } else {
        _boxFocus[k].requestFocus();
      }
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
    if (_localError != null) setState(() => _localError = null);
    if (ref.read(sessionProvider) is SessionError) {
      ref.read(sessionProvider.notifier).clearPasswordError(
            phone: widget.phone,
            setup: widget.setup,
          );
    }
    if (_joined.length == 6) _complete();
  }

  Future<void> _complete() async {
    final code = _joined;
    if (widget.setup && !_confirming) {
      setState(() {
        _first = code;
        _confirming = true;
      });
      _clearBoxes();
      return;
    }
    if (widget.setup) {
      if (code != _first) {
        setState(() {
          _localError =
              AppLocalizations.of(context).passwordMismatch;
          _first = null;
          _confirming = false;
        });
        _clearBoxes();
        return;
      }
      ref.read(sessionProvider.notifier).beginPasswordSetup(
            phone: widget.phone,
            password: code,
          );
      if (mounted) context.go('/name');
      return;
    }
    if (_busy) return;
    setState(() => _busy = true);
    await ref.read(sessionProvider.notifier).verifyPassword(
          phone: widget.phone,
          password: code,
        );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      if (next is SessionSignedIn) {
        context.go('/chats');
      } else if (next is SessionRegisterProfile) {
        context.go('/name');
      } else if (next is SessionError) {
        _clearBoxes();
      }
    });

    final l10n = AppLocalizations.of(context);
    final state = ref.watch(sessionProvider);
    final error = state is SessionError ? state : null;

    return OnboardingScaffold(
      showLogo: false,
      title: widget.setup
          ? (_confirming
              ? l10n.passwordConfirmTitle
              : l10n.passwordCreateTitle)
          : l10n.passwordEnterTitle,
      subtitle: widget.setup
          ? l10n.passwordCreateSubtitle
          : l10n.passwordEnterSubtitle(widget.phone),
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
                    obscureText: true,
                    obscuringCharacter: '•',
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
          if (_localError != null || error != null) ...[
            const SizedBox(height: 12),
            Text(
              _localError ??
                  AuthErrorLocalizer.message(
                    l10n,
                    code: error?.code,
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
            label: widget.setup ? l10n.continueAction : l10n.passwordSignIn,
            loading: _busy,
            onPressed: _busy || _joined.length != 6 ? null : _complete,
          ),
        ],
      ),
    );
  }
}
