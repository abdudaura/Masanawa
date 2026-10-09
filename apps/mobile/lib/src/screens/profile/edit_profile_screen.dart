import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../social/own_profile_transport.dart';
import '../../profile_avatar/avatar_crop_sheet.dart';
import '../../profile_avatar/avatar_transport.dart';
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
  final _handle = TextEditingController();
  final _bio = TextEditingController();
  HumanProfile? _profile;
  bool _loading = true;
  bool _saving = false;
  bool _savingPhoto = false;
  bool _creatingProfile = false;
  bool _removeAvatar = false;
  // A timed-out/uncertain write may already be committed on the server.
  // Do not send another mutation until an authoritative GET reconciles it.
  bool _requiresReload = false;
  String? _error;
  String? _accountId;
  int _accountEpoch = 0;
  int _loadVersion = 0;
  late final ProviderSubscription<SessionState> _sessionSubscription;

  String? _signedInId(SessionState session) =>
      session is SessionSignedIn ? session.user.id : null;

  // A Future must never apply the old account's data to a new session.
  bool _sameAccount(int epoch) {
    if (!mounted || epoch != _accountEpoch || _accountId == null) return false;
    return _signedInId(ref.read(sessionProvider)) == _accountId;
  }

  @override
  void initState() {
    super.initState();
    _accountId = _signedInId(ref.read(sessionProvider));
    _sessionSubscription = ref.listenManual<SessionState>(
      sessionProvider,
      (previous, next) {
        final nextId = _signedInId(next);
        // Refreshing the same user's token should not discard the draft.
        if (nextId == _accountId) return;
        _accountId = nextId;
        _accountEpoch++;
        _loadVersion++;
        setState(() {
          _profile = null;
          _creatingProfile = false;
          _removeAvatar = false;
          _requiresReload = false;
          _saving = false;
          _savingPhoto = false;
          _loading = nextId != null;
          _error = nextId == null ? 'Sign in to edit your profile.' : null;
          _name.clear();
          _handle.clear();
          _bio.clear();
        });
        if (nextId != null) _load();
      },
    );
    if (_accountId != null) {
      _load();
    } else {
      _loading = false;
      _error = 'Sign in to edit your profile.';
    }
  }

  @override
  void dispose() {
    _sessionSubscription.close();
    _name.dispose();
    _handle.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final epoch = _accountEpoch;
    if (!_sameAccount(epoch)) return;
    final version = ++_loadVersion;
    bool current() => _sameAccount(epoch) && version == _loadVersion;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await ref.read(ownProfileTransportProvider).loadSelf();
      if (!current()) return;
      setState(() {
        _profile = profile;
        _creatingProfile = false;
        _handle.text = profile.handle;
        _name.text = profile.displayName;
        _bio.text = profile.bio;
        _removeAvatar = false;
        _requiresReload = false;
      });
    } on DioException catch (error) {
      if (!current()) return;
      if (error.response?.statusCode == 404) {
        final session = ref.read(sessionProvider);
        setState(() {
          _creatingProfile = true;
          _profile = null;
          _handle.clear();
          _name.text = session is SessionSignedIn ? session.user.name : '';
          _bio.clear();
          _removeAvatar = false;
          _requiresReload = false;
        });
      } else {
        setState(() {
          _requiresReload = true;
          _error = 'Could not load your profile. Check your connection and retry.';
        });
      }
    } catch (_) {
      if (!current()) return;
      setState(() {
        _requiresReload = true;
        _error = 'Could not load your profile. Check your connection and retry.';
      });
    } finally {
      if (current()) setState(() => _loading = false);
    }
  }

  bool get _changed {
    final profile = _profile;
    if (_creatingProfile) {
      return _name.text.trim().isNotEmpty && _handle.text.trim().isNotEmpty;
    }
    if (profile == null) return false;
    return _name.text.trim() != profile.displayName ||
        _bio.text.trim() != profile.bio ||
        _removeAvatar;
  }

  Future<void> _save() async {
    final epoch = _accountEpoch;
    final current = _profile;
    if (!_sameAccount(epoch) || (current == null && !_creatingProfile) ||
        _requiresReload || _saving || _savingPhoto || !_changed ||
        !_form.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final name = _name.text.trim();
      final bio = _bio.text.trim();
      final transport = ref.read(ownProfileTransportProvider);
      final hasTextChanges = current != null &&
          (name != current.displayName || bio != current.bio);
      final changedText = current == null
          ? await transport.createSelf(
              handle: _handle.text.trim().toLowerCase(),
              displayName: name,
              bio: bio,
            )
          : hasTextChanges
              ? await transport.updateSelf(
                  displayName: name == current.displayName ? null : name,
                  bio: bio == current.bio ? null : bio,
                )
              : current;
      // A prior-account update may finish after logout or account switching.
      // Never send its follow-up deletion on the new account.
      if (!_sameAccount(epoch)) return;
      if (_removeAvatar && current?.avatarUrl?.isNotEmpty == true) {
        await ref.read(profileAvatarTransportProvider).remove(
          expectedUrl: current!.avatarUrl!,
        );
      }
      if (!_sameAccount(epoch)) return;
      final updated = _removeAvatar ? await transport.loadSelf() : changedText;
      if (!_sameAccount(epoch)) return;
      setState(() {
        _profile = updated;
        _creatingProfile = false;
        _handle.text = updated.handle;
        _name.text = updated.displayName;
        _bio.text = updated.bio;
        _removeAvatar = false;
      });
      if (current != null) ref.invalidate(humanProfileProvider(current.handle));
      ref.invalidate(humanProfileProvider(updated.handle));
      final session = ref.read(sessionProvider);
      if (session is SessionSignedIn) {
        ref.invalidate(humanProfileByUserIdProvider(session.user.id));
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile saved.')),
      );
    } on DioException catch (error) {
      if (!_sameAccount(epoch)) return;
      final status = error.response?.statusCode;
      setState(() {
        _requiresReload = true;
        if (status == 409) {
          _error = _creatingProfile
              ? 'This handle may be taken, or your profile already exists. '
                'Choose another handle or reload your profile.'
              : 'Your profile changed elsewhere. Reload before saving again.';
        } else if (status == 401 || status == 403) {
          _error = 'Your session needs to be renewed. Sign in and reload.';
        } else {
          _error = 'Could not confirm whether your changes saved. '
              'Reload your profile before trying again.';
        }
      });
    } catch (_) {
      if (!_sameAccount(epoch)) return;
      setState(() {
        _requiresReload = true;
        _error = 'Could not confirm whether your changes saved. '
            'Reload your profile before trying again.';
      });
    } finally {
      if (_sameAccount(epoch)) setState(() => _saving = false);
    }
  }

  Future<void> _pickPhoto() async {
    final epoch = _accountEpoch;
    final profile = _profile;
    if (!_sameAccount(epoch) || profile == null || _requiresReload ||
        _saving || _savingPhoto) return;
    if (_changed) {
      setState(() => _error =
          'Save your other profile changes before changing your photo.');
      return;
    }
    var uploadDispatched = false;
    try {
      final png = await pickAndCropAvatar(context);
      if (png == null || !_sameAccount(epoch)) return;
      setState(() {
        _savingPhoto = true;
        _error = null;
      });
      // Once a network mutation starts, even a timeout may represent success.
      uploadDispatched = true;
      final url = await ref.read(profileAvatarTransportProvider).upload(
        png, expectedUrl: profile.avatarUrl,
      );
      if (!_sameAccount(epoch)) return;
      final updated = await ref.read(ownProfileTransportProvider).loadSelf();
      if (!_sameAccount(epoch)) return;
      if (updated.avatarUrl != url) {
        throw const FormatException('Profile photo update not confirmed');
      }
      setState(() {
        _profile = updated;
        _removeAvatar = false;
      });
      ref.invalidate(humanProfileProvider(profile.handle));
      ref.invalidate(humanProfileProvider(updated.handle));
      final session = ref.read(sessionProvider);
      if (session is SessionSignedIn) {
        ref.invalidate(humanProfileByUserIdProvider(session.user.id));
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile photo updated.')),
      );
    } on DioException catch (error) {
      if (!_sameAccount(epoch)) return;
      setState(() {
        if (uploadDispatched) _requiresReload = true;
        _error = error.response?.statusCode == 404
          ? 'Profile photo storage is unavailable right now.'
          : error.response?.statusCode == 409
              ? 'Your photo changed on another device. Reload and try again.'
              : 'Could not confirm the photo update. Reload before retrying.';
      });
    } catch (_) {
      if (_sameAccount(epoch)) {
        setState(() {
          if (uploadDispatched) _requiresReload = true;
          _error = uploadDispatched
              ? 'Could not confirm the photo update. Reload before retrying.'
              : 'Could not prepare the photo. Choose another image.';
        });
      }
    } finally {
      if (_sameAccount(epoch)) setState(() => _savingPhoto = false);
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
          : profile == null && !_creatingProfile
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error ?? 'Your profile is unavailable.'),
                      const SizedBox(height: 12),
                      if (_accountId != null)
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
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 36),
                      child: Column(children: [
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
                        if (profile != null) ...[
                          const SizedBox(height: 8),
                          Center(
                            child: TextButton.icon(
                              key: const ValueKey('profile-change-photo'),
                              onPressed: _saving || _savingPhoto || _removeAvatar ||
                                      _requiresReload ? null : _pickPhoto,
                              icon: _savingPhoto
                                  ? const SizedBox(
                                      width: 18, height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.add_a_photo_outlined),
                              label: Text(avatar == null || avatar.isEmpty
                                  ? 'Add photo' : 'Change photo'),
                            ),
                          ),
                        ],
                        if (_removeAvatar && profile?.avatarUrl?.isNotEmpty == true)
                          Center(
                            child: TextButton(
                              key: const ValueKey('profile-undo-photo-removal'),
                              onPressed: _saving || _savingPhoto ? null
                                  : () => setState(() => _removeAvatar = false),
                              child: const Text('Keep current photo'),
                            ),
                          )
                        else if (avatar != null && avatar.isNotEmpty)
                          Center(
                            child: TextButton.icon(
                              key: const ValueKey('profile-remove-photo'),
                              onPressed: _saving || _savingPhoto || _requiresReload
                                  ? null : () => setState(() => _removeAvatar = true),
                              icon: const Icon(Icons.delete_outline_rounded),
                              label: const Text('Remove photo'),
                            ),
                          ),
                        const SizedBox(height: 22),
                        TextFormField(
                          key: const ValueKey('profile-edit-name'),
                          controller: _name,
                          enabled: !_saving && !_savingPhoto,
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
                          enabled: !_saving && !_savingPhoto,
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
                        if (_creatingProfile)
                          TextFormField(
                            key: const ValueKey('profile-create-handle'),
                            controller: _handle,
                            enabled: !_saving && !_savingPhoto,
                            maxLength: 40,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                              labelText: 'Public handle',
                              prefixText: '@',
                              helperText: 'Letters, numbers, dots, underscores or hyphens',
                            ),
                            validator: (value) =>
                                RegExp(r'^[a-z0-9_][a-z0-9_.-]{1,39}$')
                                        .hasMatch(value?.trim().toLowerCase() ?? '')
                                    ? null
                                    : 'Enter a valid handle (2–40 characters)',
                          )
                        else
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.alternate_email_rounded),
                            title: Text('@' + profile!.handle),
                            subtitle: const Text(
                              'Your handle is fixed until linked Talk '
                              'and invitation references can be migrated safely.',
                            ),
                          ),
                        if (_error != null) ...[
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text(
                              _error!,
                              style: TextStyle(color: u.emergency),
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton.icon(
                              key: const ValueKey('profile-reload'),
                              onPressed: _saving ? null : _load,
                              icon: const Icon(Icons.refresh_rounded),
                              label: const Text('Reload from server'),
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        FilledButton(
                          key: const ValueKey('profile-edit-save'),
                          onPressed: _saving || _savingPhoto || _requiresReload ||
                              !_changed ? null : _save,
                          child: _saving
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Text(
                                  _creatingProfile ? 'Create profile' : 'Save profile',
                                ),
                        ),
                      ]),
                    ),
                  ),
                ),
    );
  }
}
