import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/phone/country_codes.dart';
import '../../core/providers.dart';
import '../../state/session_state.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../ui/components/onboarding_scaffold.dart';
import '../../ui/components/phone_field.dart';
import '../../ui/components/primary_button.dart';

/// Login with two options (both OTP-verified):
/// - Phone: a code is sent by SMS and entered on the next screen.
/// - Email: a code is sent by email and entered on the next screen.
///
/// No silent sign-in: every number must prove ownership via OTP.
class PhoneLoginScreen extends ConsumerStatefulWidget {
  const PhoneLoginScreen({super.key});

  @override
  ConsumerState<PhoneLoginScreen> createState() => _PhoneLoginScreenState();
}

class _PhoneLoginScreenState extends ConsumerState<PhoneLoginScreen> {
  final _phone = TextEditingController();
  final _email = TextEditingController();
  OtpChannel _channel = OtpChannel.email;
  Set<OtpChannel> _availableChannels = {OtpChannel.email};
  bool _loadingCapabilities = true;
  PhoneCountry _country = kDefaultCountry;

  @override
  void initState() {
    super.initState();
    _loadCapabilities();
  }

  Future<void> _loadCapabilities() async {
    Set<OtpChannel> channels;
    try {
      final result = await ref.read(apiClientProvider).authCapabilities();
      channels = result.otpChannels.toSet();
    } catch (_) {
      // Older/unreachable gateways fail closed to email rather than exposing
      // an SMS option that may not be configured.
      channels = {OtpChannel.email};
    }
    if (!mounted) return;
    setState(() {
      _availableChannels = channels;
      _loadingCapabilities = false;
      if (!_availableChannels.contains(_channel)) {
        _channel = _availableChannels.contains(OtpChannel.email)
            ? OtpChannel.email
            : (_availableChannels.isNotEmpty
                ? _availableChannels.first
                : OtpChannel.email);
      }
    });
  }

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  bool get _isEmail => _channel == OtpChannel.email;

  void _continueWithPhone() {
    if (!_availableChannels.contains(OtpChannel.sms)) return;
    final e164 = normalizeE164(_phone.text);
    final digits = e164.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 7 || digits.length > 15) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid phone number')),
      );
      return;
    }
    // Verified path: SMS code must be entered on /otp. No silent login.
    ref.read(sessionProvider.notifier).sendOtp(phone: e164);
  }

  void _sendEmailCode() {
    if (!_availableChannels.contains(OtpChannel.email)) return;
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
        context.go(next.user.isNewUser ? '/name' : '/chats');
      }
    });

    final state = ref.watch(sessionProvider);
    final sending = state is SessionSendingOtp;
    final error = state is SessionError ? state : null;

    return OnboardingScaffold(
      title: _isEmail ? 'What email should we use?' : 'What number should we use?',
      subtitle: 'We will send a one-time code to verify it.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_loadingCapabilities) ...[
            const LinearProgressIndicator(minHeight: 2),
            const SizedBox(height: 20),
          ] else if (_availableChannels.length > 1) ...[
            SegmentedButton<OtpChannel>(
              segments: [
                if (_availableChannels.contains(OtpChannel.sms))
                  const ButtonSegment(
                    value: OtpChannel.sms,
                    label: Text('Phone'),
                    icon: Icon(Icons.phone_outlined),
                  ),
                if (_availableChannels.contains(OtpChannel.email))
                  const ButtonSegment(
                    value: OtpChannel.email,
                    label: Text('Email'),
                    icon: Icon(Icons.mail_outline),
                  ),
              ],
              selected: {_channel},
              onSelectionChanged: (selection) {
                if (selection.isNotEmpty) {
                  setState(() => _channel = selection.first);
                }
              },
            ),
            const SizedBox(height: 20),
          ] else if (_availableChannels.isNotEmpty) ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _isEmail ? Icons.mail_outline : Icons.phone_outlined,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Text(_isEmail ? 'Email verification' : 'Phone verification'),
              ],
            ),
            const SizedBox(height: 20),
          ] else ...[
            Text(
              'Sign-in is temporarily unavailable.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            const SizedBox(height: 20),
          ],
          if (_isEmail)
            TextField(
              controller: _email,
              autofocus: true,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              style: TextStyle(
                fontSize: MasanawaTokens.fontSize['md'],
                color: Theme.of(context).colorScheme.onSurface,
              ),
              decoration: InputDecoration(
                hintText: 'you@example.com',
                hintStyle: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                prefixIcon: Icon(
                  Icons.mail_outline,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
                filled: true,
                fillColor: Theme.of(context).colorScheme.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(MasanawaTokens.radius['md']!),
                ),
              ),
            )
          else
            PhoneField(
              controller: _phone,
              autofocus: true,
              onCountryChanged: (c) => setState(() => _country = c),
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
          if (_isEmail)
            PrimaryButton(
              label: sending ? 'Sending code…' : 'Send code',
              loading: sending,
              onPressed: _loadingCapabilities ||
                      !_availableChannels.contains(OtpChannel.email)
                  ? null
                  : _sendEmailCode,
            )
          else
            PrimaryButton(
              label: sending ? 'Sending code…' : 'Continue',
              loading: sending,
              onPressed: _loadingCapabilities ||
                      !_availableChannels.contains(OtpChannel.sms)
                  ? null
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
      ),
    );
  }
}
