import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../localization/auth_error_localizer.dart';
import '../../localization/language_picker_button.dart';
import '../../core/api/models.dart';
import '../../core/phone/country_codes.dart';
import '../../state/session_state.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../ui/components/onboarding_scaffold.dart';
import '../../ui/components/phone_field.dart';
import '../../ui/components/primary_button.dart';

class NameScreen extends ConsumerStatefulWidget {
  const NameScreen({super.key});

  @override
  ConsumerState<NameScreen> createState() => _NameScreenState();
}

class _NameScreenState extends ConsumerState<NameScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _submit() async {
    final current = ref.read(sessionProvider);
    if (current is SessionSignedIn) {
      context.go('/chats');
      return;
    }
    // Email sign-ups arrive without a phone number: every account leaves
    // this step with phone + name. Password-setup sign-ups already carry
    // their phone; OTP phone sign-ups carry it in the state.
    String? phone;
    if (current is SessionNameRequired &&
        current.channel == OtpChannel.email) {
      final e164 = normalizeE164(_phone.text);
      final digits = e164.replaceAll(RegExp(r'\D'), '');
      if (digits.length < 7 || digits.length > 15) {
        _snack(AppLocalizations.of(context).invalidPhoneNumber);
        return;
      }
      phone = e164;
    }
    if (current is! SessionNameRequired &&
        current is! SessionRegisterProfile) {
      context.go('/phone-login');
      return;
    }

    final name = _name.text.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (name.length < 2) {
      _snack(AppLocalizations.of(context).fullNameRequired);
      return;
    }
    if (_saving) return;
    setState(() => _saving = true);
    await ref.read(sessionProvider.notifier).submitProfile(
          name: name,
          phone: phone,
        );
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      if (next is SessionSignedIn) {
        context.go('/chats');
      } else if (next is SessionNameRequired && next.message != null) {
        _snack(AuthErrorLocalizer.message(
          AppLocalizations.of(context),
          code: null,
          stage: AuthFailureStage.completeProfile,
        ));
      } else if (next is SessionError) {
        _snack(AuthErrorLocalizer.message(
          AppLocalizations.of(context),
          code: next.code,
          stage: AuthFailureStage.completeProfile,
        ));
      } else if (next is SessionSignedOut) {
        context.go('/phone-login');
      }
    });

    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionProvider);
    final identifier = session is SessionNameRequired
        ? session.identifier
        : session is SessionRegisterProfile
            ? session.phone
            : session is SessionSignedIn
                ? (session.user.phone ?? session.user.email ?? '')
                : '';
    final needsPhone =
        session is SessionNameRequired && session.channel == OtpChannel.email;

    return OnboardingScaffold(
      showLogo: false,
      title: l10n.nameQuestion,
      subtitle: identifier.isEmpty
          ? l10n.completeProfile
          : l10n.codeVerifiedName,
      canGoBack: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: Alignment.center,
            child: LanguagePickerButton(),
          ),
          const SizedBox(height: 8),
          if (needsPhone) ...[
            PhoneField(controller: _phone, autofocus: false),
            const SizedBox(height: 16),
          ],
          TextField(
            controller: _name,
            autofocus: false,
            enabled: !_saving,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            style: TextStyle(
              fontSize: MasanawaTokens.fontSize['md'],
              color: Theme.of(context).colorScheme.onSurface,
            ),
            decoration: InputDecoration(
              labelText: l10n.fullNameLabel,
              hintText: l10n.fullNameExample,
              prefixIcon: const Icon(Icons.person_outline),
              filled: true,
              fillColor: Theme.of(context).colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius:
                    BorderRadius.circular(MasanawaTokens.radius['md']!),
              ),
            ),
          ),
          const SizedBox(height: 24),
          PrimaryButton(
            label: _saving ? l10n.finishingSignIn : l10n.continueAction,
            loading: _saving,
            onPressed: _saving ? null : _submit,
          ),
          const SizedBox(height: 12),
          Text(
            l10n.verifiedSignInNotice,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: MasanawaTokens.fontSize['xs'],
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
