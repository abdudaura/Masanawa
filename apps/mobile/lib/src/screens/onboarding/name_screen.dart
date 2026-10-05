import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../state/session_state.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../ui/components/onboarding_scaffold.dart';
import '../../ui/components/primary_button.dart';

class NameScreen extends ConsumerStatefulWidget {
  const NameScreen({super.key});

  @override
  ConsumerState<NameScreen> createState() => _NameScreenState();
}

class _NameScreenState extends ConsumerState<NameScreen> {
  final _name = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
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
    if (current is! SessionNameRequired) {
      context.go('/phone-login');
      return;
    }

    final name = _name.text.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (name.length < 2) {
      _snack('Please enter your full name');
      return;
    }
    if (_saving) return;
    setState(() => _saving = true);
    await ref.read(sessionProvider.notifier).verifyOtp(
          current.code,
          phone: current.channel == OtpChannel.sms ? current.identifier : null,
          email: current.channel == OtpChannel.email ? current.identifier : null,
          name: name,
        );
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      if (next is SessionSignedIn) {
        context.go('/chats');
      } else if (next is SessionNameRequired && next.message != null) {
        _snack(next.message!);
      } else if (next is SessionError) {
        _snack(next.message);
        context.go('/phone-login');
      } else if (next is SessionSignedOut) {
        context.go('/phone-login');
      }
    });

    final session = ref.watch(sessionProvider);
    final identifier = session is SessionNameRequired
        ? session.identifier
        : session is SessionSignedIn
            ? (session.user.phone ?? session.user.email ?? '')
            : '';

    return OnboardingScaffold(
      title: 'What should we call you?',
      subtitle: identifier.isEmpty
          ? 'Complete your Masanawa profile.'
          : 'Your code is verified. Add your name to finish signing in.',
      canGoBack: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _name,
            autofocus: true,
            enabled: !_saving,
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            style: TextStyle(
              fontSize: MasanawaTokens.fontSize['md'],
              color: Theme.of(context).colorScheme.onSurface,
            ),
            decoration: InputDecoration(
              labelText: 'Full name',
              hintText: 'e.g. Amina Bello',
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
            label: _saving ? 'Finishing sign in…' : 'Continue',
            loading: _saving,
            onPressed: _saving ? null : _submit,
          ),
          const SizedBox(height: 12),
          Text(
            'Your verified phone number or email remains your sign-in method.',
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
