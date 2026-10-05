import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
  final _email = TextEditingController();
  OtpChannel _channel = OtpChannel.email;
  List<OtpChannel>? _availableChannels;
  String? _capabilityError;

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
      setState(() => _capabilityError = error.message);
    } catch (_) {
      if (!mounted) return;
      setState(
        () => _capabilityError =
            'Could not load sign-in methods. Check your connection and try again.',
      );
    }
  }

  void _continueWithPhone() {
    final e164 = normalizeE164(_phone.text);
    final digits = e164.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 7 || digits.length > 15) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid phone number')),
      );
      return;
    }
    ref.read(sessionProvider.notifier).sendOtp(phone: e164);
  }

  void _sendEmailCode() {
    final email = _email.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid email address')),
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
      } else if (next is SessionSignedIn) {
        context.go('/chats');
      }
    });

    final state = ref.watch(sessionProvider);
    final sending = state is SessionSendingOtp;
    final error = state is SessionError ? state : null;
    final channels = _availableChannels;

    return OnboardingScaffold(
      title: channels == null
          ? 'Sign in to Masanawa'
          : _isEmail
              ? 'What email should we use?'
              : 'What number should we use?',
      subtitle: channels == null
          ? 'Checking the available secure sign-in methods…'
          : 'We will send a one-time code to verify it.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_capabilityError != null) ...[
            Icon(
              Icons.cloud_off_outlined,
              size: 42,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 12),
            Text(
              _capabilityError!,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: MasanawaTokens.fontSize['sm'],
              ),
            ),
            const SizedBox(height: 18),
            PrimaryButton(
              label: 'Try again',
              onPressed: _loadCapabilities,
            ),
          ] else if (channels == null) ...[
            const Center(child: CircularProgressIndicator()),
          ] else ...[
            if (channels.length > 1) ...[
              SegmentedButton<OtpChannel>(
                segments: [
                  if (channels.contains(OtpChannel.sms))
                    const ButtonSegment(
                      value: OtpChannel.sms,
                      label: Text('Phone'),
                      icon: Icon(Icons.phone_outlined),
                    ),
                  if (channels.contains(OtpChannel.email))
                    const ButtonSegment(
                      value: OtpChannel.email,
                      label: Text('Email'),
                      icon: Icon(Icons.mail_outline),
                    ),
                ],
                selected: {_channel},
                onSelectionChanged: sending
                    ? null
                    : (selection) {
                        setState(() => _channel = selection.first);
                      },
              ),
              const SizedBox(height: 20),
            ],
            if (_isEmail)
              TextField(
                controller: _email,
                autofocus: true,
                enabled: !sending,
                keyboardType: TextInputType.emailAddress,
                autocorrect: false,
                style: TextStyle(
                  fontSize: MasanawaTokens.fontSize['md'],
                  color: Theme.of(context).colorScheme.onSurface,
                ),
                decoration: InputDecoration(
                  hintText: 'you@example.com',
                  prefixIcon: Icon(
                    Icons.mail_outline,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  filled: true,
                  fillColor: Theme.of(context).colorScheme.surface,
                  border: OutlineInputBorder(
                    borderRadius:
                        BorderRadius.circular(MasanawaTokens.radius['md']!),
                  ),
                ),
              )
            else
              PhoneField(
                controller: _phone,
                autofocus: true,
              ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(
                error.message,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: MasanawaTokens.fontSize['sm'],
                ),
              ),
            ],
            const SizedBox(height: 24),
            PrimaryButton(
              label: sending
                  ? 'Sending code…'
                  : _isEmail
                      ? 'Send code'
                      : 'Continue',
              loading: sending,
              onPressed: sending
                  ? null
                  : _isEmail
                      ? _sendEmailCode
                      : _continueWithPhone,
            ),
            const SizedBox(height: 8),
            Text(
              'By continuing you agree to our Terms and Privacy Policy.',
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
