import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
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
  bool _prefilled = false;
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
    if (current is! SessionSignedIn) {
      context.go('/phone-login');
      return;
    }
    if (!current.user.isNewUser) {
      context.go('/chats');
      return;
    }
    final name = _name.text.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (name.length < 2) {
      _snack('Please enter your full name');
      return;
    }
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(sessionProvider.notifier).updateProfile(name: name);
    } on ApiException catch (error) {
      if (mounted) _snack(error.message);
    } catch (_) {
      if (mounted) _snack('Could not save your profile. Please try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sessionProvider, (previous, next) {
      if (next is SessionSignedIn && !next.user.isNewUser) {
        context.go('/chats');
      } else if (next is SessionError) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(next.message)));
      } else if (next is SessionSignedOut) {
        context.go('/phone-login');
      }
    });

    final session = ref.watch(sessionProvider);
    final signedIn = session is SessionSignedIn ? session : null;
    if (!_prefilled && signedIn != null) {
      _prefilled = true;
      if (signedIn.user.name.isNotEmpty) _name.text = signedIn.user.name;
    }
    final alreadyComplete = signedIn != null && !signedIn.user.isNewUser;

    return OnboardingScaffold(
      title: 'What should we call you?',
      subtitle: 'This name appears on your Masanawa account.',
      canGoBack: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _name,
            autofocus: !alreadyComplete,
            enabled: !alreadyComplete,
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
            label: 'Continue',
            loading: _saving,
            onPressed: _saving
                ? null
                : alreadyComplete
                    ? () => context.go('/chats')
                    : _submit,
          ),
          const SizedBox(height: 12),
          Text(
            alreadyComplete
                ? 'Your profile is ready.'
                : 'Your verified phone number or email remains your sign-in method.',
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
