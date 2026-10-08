import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../social/self_profile_edit.dart';
import '../../social/talk_social_profiles.dart';
import '../../state/session_state.dart';
import '../../state/talk_social_profile_state.dart';

final selfProfileEditTransportProvider = Provider<SelfProfileEditTransport>(
  (ref) => GatewaySelfProfileEditTransport(ref.watch(apiClientProvider)),
);

/// Server-persisted public identity editor. Image modification deliberately
/// requires a separate, owned-media upload protocol; this screen never stores
/// a local photo as though it were successfully uploaded.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _name = TextEditingController();
  final _handle = TextEditingController();
  final _bio = TextEditingController();

  bool _hydrated = false;
  bool _saving = false;
  String? _error;
  String? _initialHandle;

  @override
  void dispose() {
    _name.dispose();
    _handle.dispose();
    _bio.dispose();
    super.dispose();
  }

  void _hydrate(HumanProfile? profile, String sessionName) {
    if (_hydrated) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _hydrated) return;
      _name.text = profile?.displayName ?? sessionName;
      _handle.text = profile?.handle ?? '';
      _bio.text = profile?.bio ?? '';
      _initialHandle = profile?.handle;
      setState(() => _hydrated = true);
    });
  }

  Future<void> _save(String userId) async {
    if (_saving) return;
    final draft = SelfProfileDraft(
      handle: _handle.text,
      displayName: _name.text,
      bio: _bio.text,
    );
    final issue = draft.validate();
    if (issue != null) {
      setState(() => _error = issue);
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final saved = await ref.read(selfProfileEditTransportProvider).save(draft);
      if (!mounted) return;
      final previousHandle = _initialHandle;
      _initialHandle = saved.handle;
      _name.text = saved.displayName;
      _handle.text = saved.handle;
      _bio.text = saved.bio;
      ref.invalidate(humanProfileByUserIdProvider(userId));
      if (previousHandle != null && previousHandle.isNotEmpty) {
        ref.invalidate(humanProfileProvider(previousHandle));
      }
      ref.invalidate(humanProfileProvider(saved.handle));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile saved.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is ProfileHandleTaken
            ? 'This handle is already taken. Choose another.'
            : 'Could not save your profile. Check your connection and try again.';
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    if (session is! SessionSignedIn) {
      return const Scaffold(
        body: Center(child: Text('Sign in to edit your profile.')),
      );
    }

    final profileAsync = ref.watch(humanProfileByUserIdProvider(session.user.id));
    return Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Could not load your saved profile.'),
              TextButton(
                onPressed: () => ref.invalidate(
                  humanProfileByUserIdProvider(session.user.id),
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (profile) {
          _hydrate(profile, session.user.name);
          if (!_hydrated) {
            return const Center(child: CircularProgressIndicator());
          }
          final avatar = profile?.avatarUrl?.trim();
          final initials = _name.text.trim().isEmpty
              ? 'U'
              : String.fromCharCode(_name.text.trim().runes.first).toUpperCase();
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
            children: [
              Center(
                child: CircleAvatar(
                  radius: 42,
                  backgroundImage: avatar != null && avatar.isNotEmpty
                      ? NetworkImage(avatar)
                      : null,
                  child: avatar == null || avatar.isEmpty
                      ? Text(initials, style: const TextStyle(fontSize: 28))
                      : null,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Photo changes require secure profile uploads, which are not enabled yet.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _name,
                enabled: !_saving,
                textCapitalization: TextCapitalization.words,
                maxLength: 160,
                decoration: const InputDecoration(labelText: 'Display name'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _handle,
                enabled: !_saving,
                maxLength: 40,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Handle',
                  prefixText: '@',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _bio,
                enabled: !_saving,
                maxLength: 1000,
                minLines: 2,
                maxLines: 5,
                decoration: const InputDecoration(labelText: 'Bio'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 8),
                Text(_error!, style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                )),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : () => _save(session.user.id),
                child: _saving
                    ? const SizedBox(
                        height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save profile'),
              ),
            ],
          );
        },
      ),
    );
  }
}
