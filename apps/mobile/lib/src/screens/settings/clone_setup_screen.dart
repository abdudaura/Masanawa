import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../agents/clone_onboarding.dart';
import '../../agents/clone_onboarding_transport.dart';
import '../../agents/masanawa_transport.dart';
import '../../core/providers.dart';
import '../../state/agent_directory_state.dart';
import '../../state/clone_onboarding_controller.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';

final cloneOnboardingTransportProvider = Provider<CloneOnboardingTransport>(
  (ref) => HttpCloneOnboardingTransport(
    dio: ref.watch(apiClientProvider).dio,
    baseUrl: kAgentBaseUrl,
  ),
);

class CloneSetupScreen extends ConsumerStatefulWidget {
  const CloneSetupScreen({super.key});
  @override
  ConsumerState<CloneSetupScreen> createState() => _CloneSetupScreenState();
}

class _CloneSetupScreenState extends ConsumerState<CloneSetupScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _bio = TextEditingController();
  final _languages = TextEditingController();
  final _personality = TextEditingController();
  final _expertise = TextEditingController();
  late CloneOnboardingController _controller;
  StreamSubscription<void>? _subscription;
  String? _owner;
  int _generation = 0;
  bool _working = false;
  bool _editing = false;
  String? _error;

  String? _account(SessionState state) =>
      state is SessionSignedIn ? state.user.id : null;
  @override
  void initState() {
    super.initState();
    _owner = _account(ref.read(sessionProvider));
    _replaceController();
    if (_owner != null) unawaited(_reload());
  }

  void _replaceController() {
    _controller = CloneOnboardingController(
      transport: ref.read(cloneOnboardingTransportProvider),
    );
    _subscription = _controller.changes.listen((_) {
      if (mounted) setState(() {});
    });
  }

  void _populate() {
    final profile = _controller.view?.profile;
    _name.text = profile?.displayName ?? '';
    _bio.text = profile?.biography ?? '';
    _languages.text = profile?.languages.join(', ') ?? '';
    _personality.text = profile?.personality.join(', ') ?? '';
    _expertise.text = profile?.expertise.join(', ') ?? '';
  }

  Future<void> _run(
    Future<bool> Function(CloneOnboardingController) operation, {
    bool populate = false,
  }) async {
    if (_working || _owner == null) return;
    final controller = _controller;
    final generation = _generation;
    setState(() {
      _working = true;
      _error = null;
    });
    try {
      final success = await operation(controller);
      if (!mounted || generation != _generation) return;
      if (success) {
        _editing = false;
        if (populate) _populate();
      }
    } finally {
      if (mounted && generation == _generation)
        setState(() => _working = false);
    }
  }

  Future<void> _reload() =>
      _run((controller) => controller.reload(), populate: true);
  List<String> _items(TextEditingController field, int maximum) {
    if (field.text.trim().isEmpty) return [];
    final items = field.text.split(',').map((item) => item.trim()).toList();
    if (items.length > maximum ||
        items.any((item) => item.isEmpty || item.length > 120) ||
        items.map((item) => item.toLowerCase()).toSet().length !=
            items.length) {
      throw const FormatException(
        'Use distinct comma-separated entries, each under 120 characters.',
      );
    }
    return items;
  }

  Future<void> _review() async {
    if (!_form.currentState!.validate()) return;
    try {
      final profile = <String, dynamic>{
        'displayName': _name.text.trim(),
        'languages': _items(_languages, 16),
      };
      if (_bio.text.trim().isNotEmpty) profile['biography'] = _bio.text.trim();
      if (_personality.text.trim().isNotEmpty)
        profile['personality'] = _items(_personality, 24);
      if (_expertise.text.trim().isNotEmpty)
        profile['expertise'] = _items(_expertise, 32);
      await _run(
        (controller) async =>
            await controller.save(profile) && await controller.preview(),
      );
    } on FormatException catch (error) {
      setState(() => _error = error.message);
    }
  }

  Future<void> _open() async {
    final result = _controller.view?.result;
    if (result == null || _working || _controller.needsReload) return;
    final generation = _generation;
    setState(() => _working = true);
    try {
      await ref.read(agentDirectoryProvider.notifier).refresh();
      if (mounted && generation == _generation)
        context.go('/chat/${Uri.encodeComponent(result.characterId)}');
    } catch (_) {
      if (mounted && generation == _generation)
        setState(
          () => _error = 'Could not open the conversation. Please try again.',
        );
    } finally {
      if (mounted && generation == _generation)
        setState(() => _working = false);
    }
  }

  @override
  void dispose() {
    _generation++;
    _subscription?.cancel();
    _controller.dispose();
    for (final field in [_name, _bio, _languages, _personality, _expertise]) {
      field.dispose();
    }
    super.dispose();
  }

  Widget _field(
    TextEditingController controller,
    String label,
    int maximum, {
    bool required = false,
    int lines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      controller: controller,
      enabled: !_working && !_controller.busy,
      maxLines: lines,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      validator: (value) {
        final text = value?.trim() ?? '';
        if (required && text.isEmpty) return 'This field is required';
        if (text.length > maximum) return 'Keep this under $maximum characters';
        return null;
      },
    ),
  );
  @override
  Widget build(BuildContext context) {
    ref.listen<SessionState>(sessionProvider, (_, next) {
      final owner = _account(next);
      if (owner == _owner) return;
      _generation++;
      _subscription?.cancel();
      _controller.dispose();
      _owner = owner;
      _working = false;
      _editing = false;
      _error = null;
      _replaceController();
      _populate();
      setState(() {});
      if (owner != null) unawaited(_reload());
    });
    final view = _controller.view;
    final enabled = !_working && !_controller.busy && !_controller.needsReload;
    final form =
        view != null &&
        !view.confirmed &&
        (view.state != 'preview' || _editing);
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: const Text('Your personal clone'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/settings'),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_owner == null)
              const Text('Sign in to create or resume your personal clone.')
            else ...[
              if (_working || _controller.busy) const LinearProgressIndicator(),
              if (_error != null || _controller.error != null)
                Semantics(
                  liveRegion: true,
                  child: Text(_error ?? _controller.error!),
                ),
              if (view == null || _controller.needsReload)
                OutlinedButton(
                  onPressed: _working ? null : _reload,
                  child: const Text('Reload saved setup'),
                ),
              if (form)
                Form(
                  key: _form,
                  child: Column(
                    children: [
                      const Text(
                        'Save your profile, review it, then confirm creation.',
                      ),
                      const SizedBox(height: 20),
                      _field(_name, 'Clone name', 120, required: true),
                      _field(
                        _languages,
                        'Languages, separated by commas',
                        1935,
                        required: true,
                      ),
                      _field(_bio, 'About you (optional)', 1000, lines: 4),
                      _field(
                        _personality,
                        'Personality traits (optional)',
                        2903,
                      ),
                      _field(_expertise, 'Areas of expertise (optional)', 3871),
                      FilledButton(
                        onPressed: enabled ? _review : null,
                        child: const Text('Save and review'),
                      ),
                    ],
                  ),
                ),
              if (view?.profile != null && !form) ...[
                const SizedBox(height: 20),
                Text(
                  view!.profile!.displayName ?? '',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text(view.profile!.languages.join(', ')),
                const SizedBox(height: 12),
                Text(view.profile!.biography),
                const SizedBox(height: 12),
                Text('Personality: ${view.profile!.personality.join(', ')}'),
                Text('Expertise: ${view.profile!.expertise.join(', ')}'),
              ],
              if (view?.state == 'preview' && !_editing) ...[
                FilledButton(
                  onPressed: enabled
                      ? () => _run((controller) => controller.confirm())
                      : null,
                  child: const Text('Confirm and create my clone'),
                ),
                TextButton(
                  onPressed: enabled
                      ? () => setState(() => _editing = true)
                      : null,
                  child: const Text('Edit profile'),
                ),
                TextButton(
                  onPressed: enabled
                      ? () => _run(
                          (controller) => controller.cancel(),
                          populate: true,
                        )
                      : null,
                  child: const Text('Cancel setup'),
                ),
              ],
              if (view?.state == 'confirmed') ...[
                const Text(
                  'Your confirmation is saved. Resume to complete the same setup.',
                ),
                FilledButton(
                  onPressed: enabled
                      ? () => _run((controller) => controller.confirm())
                      : null,
                  child: const Text('Resume confirmed setup'),
                ),
              ],
              if (view?.ready == true) ...[
                const SizedBox(height: 20),
                Text(
                  '${view!.result!.displayName} has been created. Open the conversation to check available capabilities.',
                ),
                FilledButton(
                  onPressed: enabled ? _open : null,
                  child: const Text('Open my clone'),
                ),
              ],
              const SizedBox(height: 20),
              const Text(
                'Your draft profile is private to your account. One personal clone per account.',
              ),
            ],
          ],
        ),
      ),
    );
  }
}
