import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../l10n/app_localizations.dart';
import '../../localization/auth_error_localizer.dart';
import '../../localization/language_picker_button.dart';
import '../../core/api/models.dart';
import '../../core/network/api_client.dart';
import '../../core/phone/country_codes.dart';
import '../../core/providers.dart';
import '../../state/session_state.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../ui/components/onboarding_scaffold.dart';
import '../../ui/components/phone_field.dart';
import '../../ui/components/primary_button.dart';

class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final _phone = TextEditingController();
  PhoneCountry _phoneCountry = kDefaultCountry;
  final _email = TextEditingController();
  OtpChannel _channel = OtpChannel.email;
  List<OtpChannel>? _availableChannels;
  String? _capabilityError;
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    _loadCapabilities();
  }

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  bool get _isEmail => _channel == OtpChannel.email;

  Future<void> _loadCapabilities() async {
    if (mounted) {
      setState(() {
        _availableChannels = null;
        _capabilityError = null;
      });
    }
    try {
      final channels = await ref.read(apiClientProvider).authOtpChannels();
      if (channels.isEmpty) {
        throw const ApiException(
          'Sign-in is temporarily unavailable. Please try again shortly.',
          code: 'AUTH_UNAVAILABLE',
        );
      }
      if (!mounted) return;
      setState(() {
        _availableChannels = channels;
        if (!channels.contains(_channel)) _channel = channels.first;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _capabilityError = error.code ?? 'UNKNOWN_AUTH_ERROR');
    } catch (_) {
      if (!mounted) return;
      setState(() => _capabilityError = 'UNKNOWN_AUTH_ERROR');
    }
  }

  void _continueWithPhone() async {
    final e164 = normalizeE164(_phone.text, country: _phoneCountry);
    final digits = e164.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 7 || digits.length > 15) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).invalidPhoneNumber),
        ),
      );
      return;
    }
    // Phone login uses the 6-digit device password, not SMS OTP. Email
    // keeps real OTP below.
    setState(() => _checking = true);
    await ref.read(sessionProvider.notifier).startPhoneLogin(e164);
    if (mounted) setState(() => _checking = false);
  }

  void _sendEmailCode() {
    final email = _email.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context).invalidEmailAddress),
        ),
      );
      return;
    }
    ref.read(sessionProvider.notifier).sendOtp(email: email);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      if (next is SessionAwaitingOtp) {
        context.go('/otp');
      } else if (next is SessionPasswordRequired) {
        context.go(
          '/password?phone=${Uri.encodeComponent(next.identifier)}'
          '&setup=${next.setup ? '1' : '0'}',
        );
      } else if (next is SessionRegisterProfile) {
        context.go('/name');
      } else if (next is SessionSignedIn) {
        context.go('/chats');
      }
    });

    final l10n = AppLocalizations.of(context);
    final state = ref.watch(sessionProvider);
    final sending = state is SessionSendingOtp;
    final error = state is SessionError ? state : null;
    final channels = _availableChannels;

    return OnboardingScaffold(
      showLogo: false,
      title: l10n.welcomeTitle,
      subtitle: channels == null
          ? l10n.checkingSignInMethods
          : l10n.signInInstruction,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Align(
            alignment: Alignment.center,
            child: LanguagePickerButton(),
          ),
          const SizedBox(height: 8),
          if (_capabilityError != null) ...[
            Icon(
              Icons.cloud_off_outlined,
              size: 42,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 12),
            Text(
              AuthErrorLocalizer.message(
                l10n,
                code: _capabilityError,
                stage: AuthFailureStage.capabilities,
              ),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: MasanawaTokens.fontSize['sm'],
              ),
            ),
            const SizedBox(height: 18),
            PrimaryButton(label: l10n.retry, onPressed: _loadCapabilities),
          ] else if (channels == null) ...[
            const Center(child: CircularProgressIndicator()),
          ] else ...[
            if (channels.length > 1) ...[
              SegmentedButton<OtpChannel>(
                segments: [
                  if (channels.contains(OtpChannel.sms))
                    ButtonSegment(
                      value: OtpChannel.sms,
                      label: Text(l10n.phoneMethod),
                      icon: const Icon(Icons.phone_outlined),
                    ),
                  if (channels.contains(OtpChannel.email))
                    ButtonSegment(
                      value: OtpChannel.email,
                      label: Text(l10n.emailMethod),
                      icon: const Icon(Icons.mail_outline),
                    ),
                ],
                selected: {_channel},
                onSelectionChanged: sending || _checking
                    ? null
                    : (selection) {
                        setState(() => _channel = selection.first);
                      },
              ),
              const SizedBox(height: 16),
            ],
            if (_isEmail)
              TextField(
                controller: _email,
                autofocus: false,
                enabled: !sending,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                style: TextStyle(
                  fontSize: MasanawaTokens.fontSize['md'],
                  color: Theme.of(context).colorScheme.onSurface,
                ),
                decoration: InputDecoration(
                  labelText: l10n.emailMethod,
                  hintText: l10n.emailExample,
                  prefixIcon: Icon(
                    Icons.mail_outline,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  filled: true,
                  fillColor: Theme.of(context).colorScheme.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(
                      MasanawaTokens.radius['md']!,
                    ),
                  ),
                ),
              )
            else
              PhoneField(
                controller: _phone,
                autofocus: true,
                enabled: !sending && !_checking,
                onCountryChanged: (country) => _phoneCountry = country,
              ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(
                AuthErrorLocalizer.message(
                  l10n,
                  code: error.code,
                  stage: AuthFailureStage.sendCode,
                ),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: MasanawaTokens.fontSize['sm'],
                ),
              ),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
              label: sending
                  ? l10n.sendingCode
                  : _checking
                  ? l10n.continueAction
                  : _isEmail
                  ? l10n.sendCode
                  : l10n.continueAction,
              loading: sending || _checking,
              onPressed: sending || _checking
                  ? null
                  : _isEmail
                  ? _sendEmailCode
                  : _continueWithPhone,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.termsNotice,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: MasanawaTokens.fontSize['xs'],
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
