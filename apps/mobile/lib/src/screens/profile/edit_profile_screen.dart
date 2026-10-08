import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../social/own_profile_transport.dart';
import '../../social/talk_social_profiles.dart';
import '../../state/session_state.dart';
import '../../state/talk_social_profile_state.dart';
import '../../theme/masanawa_theme.dart';

/// Edits the signed-in person's public identity, not an Agent/Twin profile.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _bio = TextEditingController();
  HumanProfile? _profile;
  bool _loading = true;
  bool _saving = false;
  bool _removeAvatar = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final profile = await ref.read(ownProfileTransportProvider).loadSelf();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _name.text = profile.displayName;
        _bio.text = profile.bio;
        _removeAvatar = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error =
          'Could not load your profile. Check your connection and retry.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _changed {
    final profile = _profile;
    if (profile == null) return false;
    return _name.text.trim() != profile.displayName ||
        _bio.text.trim() != profile.bio ||
        _removeAvatar;
  }

  Future<void> _save() async {
    final current = _profile;
    if (current == null || _saving || !_changed ||
        !_form.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final name = _name.text.trim();
      final bio = _bio.text.trim();
      final updated = await ref.read(ownProfileTransportProvider).updateSelf(
        ifNameChanged(current, name),
        bio: bio == current.bio ? null : bio,
        removeAvatar: _removeAvatar,
      );
      if (!mounted) return;
      setState(() {
        _profile = updated;
        _name.text = updated.displayName;
        _bio.text = updated.bio;
        _removeAvatar = false;
      });
      ref.invalidate(humanProfileProvider(current.handle));
      ref.invalidate(humanProfileProvider(updated.handle));
      final session = ref.read(sessionProvider);
      if (session is SessionSignedIn) {
        ref.invalidate(humanProfileByUserIdProvider(session.user.id));
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile saved.')),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _error =
          'Could not save your profile. Your previous details are unchanged.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final profile = _profile;
    final avatar = _removeAvatar ? null : profile?.avatarUrl?.trim();
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(title: const Text('Edit profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : profile == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error ?? 'Your profile is unavailable.'),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _load,
                        child: const Text('Try again'),
                      ),
                    ],
                  ),
                )
              : SafeArea(
                  child: Form(
                    key: _form,
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 36),
                      children: [
                        Center(
                          child: CircleAvatar(
                            radius: 46,
                            backgroundColor: u.brandStrong,
                            backgroundImage: avatar != null && avatar.isNotEmpty
                                ? NetworkImage(avatar) : null,
                            child: avatar == null || avatar.isEmpty
                                ? const Icon(Icons.person_rounded,
                                    color: Colors.white, size: 42)
                                : null,
                          ),
                        ),
                        if (avatar != null && avatar.isNotEmpty)
                          Center(
                            child: TextButton.icon(
                              key: const ValueKey('profile-remove-photo'),
                              onPressed: _saving
                                  ? null : () => setState(() => _removeAvatar = true),
                              icon: const Icon(Icons.delete_outline_rounded),
                              label: const Text('Remove photo'),
                            ),
                          ),
                        const SizedBox(height: 22),
                        TextFormField(
                          key: const ValueKey('profile-edit-name'),
                          controller: _name,
                          enabled: !_saving,
                          maxLength: 80,
                          textCapitalization: TextCapitalization.words,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                            labelText: 'Display name',
                            prefixIcon: Icon(Icons.badge_outlined),
                          ),
                          validator: (value) {
                            final name = value?.trim() ?? '';
                            return name.length < 2
                                ? 'Enter at least two characters' : null;
                          },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          key: const ValueKey('profile-edit-bio'),
                          controller: _bio,
                          enabled: !_saving,
                          maxLength: 300,
                          minLines: 3,
                          maxLines: 5,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                            labelText: 'Bio',
                            hintText: 'Tell people a little about yourself',
                            alignLabelWithHint: true,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.alternate_email_rounded),
                          title: Text('@${profile.handle}'),
                          subtitle: const Text(
                            'Your public handle is fixed until linked Talk '
                            'and invitation references can be migrated safely.',
                          ),
                        ),
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text(_error!,
                                style: TextStyle(color: u.emergency)),
                          ),
                        const SizedBox(height: 16),
                        FilledButton(
                          key: const ValueKey('profile-edit-save'),
                          onPressed: _saving || !_changed ? null : _save,
                          child: _saving
                              ? const SizedBox(
                                  height: 20, width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Save profile'),
                        ),
                      ],
                    ),
                  ),
                ),
    );
  }

  String? ifNameChanged(HumanProfile current, String name) =>
      name == current.displayName ? null : name;
}
