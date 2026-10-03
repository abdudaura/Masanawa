import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../state/session_state.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../ui/components/onboarding_scaffold.dart';
import '../../ui/components/primary_button.dart';

/// Registration: full name + email address. Phone users arrive here after the
/// codeless phone login (their number is already saved); email-code users
/// arrive here on first signup to finish creating the account.
class NameScreen extends ConsumerStatefulWidget {
  const NameScreen({super.key});

  @override
  ConsumerState<NameScreen> createState() => _NameScreenState();
}

class _NameScreenState extends ConsumerState<NameScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  bool _prefilled = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  bool _validEmail(String value) =>
      RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value.trim());

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _submit() async {
    final current = ref.read(sessionProvider);
    final name = _name.text.trim();
    final email = _email.text.trim();

    // Already fully registered (real account) — nothing to save.
    if (current is SessionSignedIn &&
        !isDevAccessToken(current.tokens.accessToken) &&
        !current.user.isNewUser) {
      context.go('/chats');
      return;
    }

    if (name.isEmpty) {
      _snack('Please enter your full name');
      return;
    }
    if (!_validEmail(email)) {
      _snack('Please enter a valid email address');
      return;
    }

    // Local dev session from a phone login — save name + email on device.
    if (current is SessionSignedIn &&
        isDevAccessToken(current.tokens.accessToken)) {
      await ref
          .read(sessionProvider.notifier)
          .updateDevProfile(name: name, email: email);
      return;
    }

    // First email-code signup: the backend creates the account with the same
    // OTP plus the name.
    if (current is SessionNameRequired) {
      final isEmailSignup = current.channel == OtpChannel.email;
      ref.read(sessionProvider.notifier).verifyOtp(
            current.code,
            phone: isEmailSignup ? null : current.identifier,
            email: isEmailSignup ? current.identifier : email,
            name: name,
          );
      return;
    }

    if (current is SessionVerifying) return;
    context.go('/chats');
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      if (next is SessionSignedIn && !next.user.isNewUser) {
        context.go('/chats');
      } else if (next is SessionError) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(next.message)));
      }
    });

    final session = ref.watch(sessionProvider);
    final submitting = session is SessionVerifying;

    // Prefill what the session already knows (name/email from either path).
    if (!_prefilled && session is SessionSignedIn) {
      _prefilled = true;
      if (session.user.name.isNotEmpty) _name.text = session.user.name;
      final existingEmail = session.user.email;
      if (existingEmail != null && existingEmail.isNotEmpty) {
        _email.text = existingEmail;
      }
    }
    final alreadyComplete =
        session is SessionSignedIn && !session.user.isNewUser;

    return OnboardingScaffold(
      title: 'Complete your profile',
      subtitle: 'Your name identifies you, and your email keeps your account safe.',
      canGoBack: true,
      backDestination: '/otp',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _name,
            autofocus: !alreadyComplete,
            enabled: !alreadyComplete,
            textCapitalization: TextCapitalization.words,
            style: TextStyle(
              fontSize: UnigeriaTokens.fontSize['md'],
              color: Theme.of(context).colorScheme.onSurface,
            ),
            decoration: InputDecoration(
              labelText: 'Full Name',
              hintText: 'e.g. Amina Bello or Emeka Okafor',
              prefixIcon: const Icon(Icons.person_outline),
              filled: true,
              fillColor: Theme.of(context).colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(UnigeriaTokens.radius['md']!),
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _email,
            enabled: !alreadyComplete,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            style: TextStyle(
              fontSize: UnigeriaTokens.fontSize['md'],
              color: Theme.of(context).colorScheme.onSurface,
            ),
            decoration: InputDecoration(
              labelText: 'Email Address',
              hintText: 'you@example.com',
              prefixIcon: const Icon(Icons.mail_outline),
              filled: true,
              fillColor: Theme.of(context).colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(UnigeriaTokens.radius['md']!),
              ),
            ),
          ),
          const SizedBox(height: 24),
          PrimaryButton(
            label: alreadyComplete
                ? 'Continue'
                : submitting
                    ? 'Creating your account…'
                    : 'Continue',
            loading: submitting,
            onPressed: _submit,
          ),
          const SizedBox(height: 12),
          Text(
            alreadyComplete
                ? 'Your profile is saved — continue to your chat.'
                : 'We use your email only for account safety and important updates.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: UnigeriaTokens.fontSize['xs'],
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
