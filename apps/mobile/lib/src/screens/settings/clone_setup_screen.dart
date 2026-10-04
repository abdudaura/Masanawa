import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../state/agent_directory_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../tokens/masanawa_tokens.dart';

class CloneSetupScreen extends ConsumerStatefulWidget {
  const CloneSetupScreen({super.key});

  @override
  ConsumerState<CloneSetupScreen> createState() => _CloneSetupScreenState();
}

class _CloneSetupScreenState extends ConsumerState<CloneSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _bio = TextEditingController();
  final _languages = TextEditingController(text: 'English, Hausa');
  final _personality = TextEditingController(text: 'Friendly, practical');
  final _expertise = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _name.dispose();
    _bio.dispose();
    _languages.dispose();
    _personality.dispose();
    _expertise.dispose();
    super.dispose();
  }

  List<String> _items(TextEditingController controller) => controller.text
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toSet()
      .toList(growable: false);

  String? _required(String? value, {int max = 1000}) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return 'This field is required';
    if (text.length > max) return 'Keep this under $max characters';
    return null;
  }

  Future<void> _createClone() async {
    if (!_formKey.currentState!.validate()) return;
    final languages = _items(_languages);
    final personality = _items(_personality);
    final expertise = _items(_expertise);
    if (languages.isEmpty || personality.isEmpty || expertise.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add at least one language, personality trait and area of expertise.'),
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final result = await ref.read(creatorCloneTransportProvider).create(
            displayName: _name.text.trim(),
            biography: _bio.text.trim(),
            languages: languages,
            personality: personality,
            expertise: expertise,
          );
      await ref.read(agentDirectoryProvider.notifier).refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.created
                ? '${result.displayName} is ready'
                : 'Your existing clone is ready',
          ),
        ),
      );
      context.go('/chat/${result.characterId}');
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not create your clone. Please try again.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        backgroundColor: u.surfaceCard,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.canPop() ? context.pop() : context.go('/settings'),
        ),
        title: const Text('Create your clone'),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 32),
            children: [
              Text(
                'Tell Masanawa who you are.',
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: MasanawaTokens.fontSize['2xl'],
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'We handle the technical setup. You can improve the same clone over time.',
                style: TextStyle(
                  color: u.textMuted,
                  fontSize: MasanawaTokens.fontSize['sm'],
                ),
              ),
              const SizedBox(height: 22),
              _Field(
                controller: _name,
                label: 'What should people call your clone?',
                hint: 'Abdullahi',
                validator: (value) => _required(value, max: 120),
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _bio,
                label: 'Tell us about yourself',
                hint: 'What you do, what you care about, and what people come to you for',
                maxLines: 4,
                validator: (value) => _required(value),
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _languages,
                label: 'Languages',
                hint: 'English, Hausa',
                validator: (value) => _required(value, max: 500),
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _personality,
                label: 'How should your clone feel?',
                hint: 'Friendly, practical, calm',
                validator: (value) => _required(value, max: 500),
              ),
              const SizedBox(height: 14),
              _Field(
                controller: _expertise,
                label: 'What are you good at?',
                hint: 'Business, technology, marketing',
                maxLines: 2,
                validator: (value) => _required(value, max: 800),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _submitting ? null : _createClone,
                icon: _submitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.auto_awesome_outlined),
                label: Text(_submitting ? 'Creating…' : 'Create my clone'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(
                      MasanawaTokens.radius['xl']!,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'One personal clone per account. Specialist Skills can be added later.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: u.textMuted,
                  fontSize: MasanawaTokens.fontSize['xs'],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.hint,
    required this.validator,
    this.maxLines = 1,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final String? Function(String?) validator;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      validator: validator,
      textInputAction:
          maxLines == 1 ? TextInputAction.next : TextInputAction.newline,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: u.surfaceCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(
            MasanawaTokens.radius['xl']!,
          ),
          borderSide: BorderSide(color: u.structuralBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(
            MasanawaTokens.radius['xl']!,
          ),
          borderSide: BorderSide(color: u.structuralBorder),
        ),
      ),
    );
  }
}
