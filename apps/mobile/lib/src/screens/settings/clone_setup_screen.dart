import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../state/agent_directory_state.dart';
import '../../state/ai_chat_state.dart';
import '../../theme/masanawa_theme.dart';
import '../../tokens/masanawa_tokens.dart';

class CloneSetupScreen extends ConsumerStatefulWidget {
  const CloneSetupScreen({super.key});

  @override
  ConsumerState<CloneSetupScreen> createState() => _CloneSetupScreenState();
}

class _CloneSetupScreenState extends ConsumerState<CloneSetupScreen> {
  final _picker = ImagePicker();
  String _gender = 'male';
  int _age = 25;
  XFile? _photo;
  bool _starting = false;

  Future<void> _pickPhoto() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
      maxWidth: 1600,
    );
    if (file != null && mounted) setState(() => _photo = file);
  }

  Future<void> _talkToGwani() async {
    final photo = _photo;
    if (photo == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add a photo for your Twin first.')),
      );
      return;
    }

    final directory = ref.read(agentDirectoryProvider);
    final support = directory.agents.where((agent) => agent.supportAgent).toList();
    final gwaniMatches = support.where(
      (agent) => agent.displayName.trim().toLowerCase() == 'gwani',
    ).toList();
    final defaultMatches = support.where((agent) => agent.defaultPlatformAgent).toList();
    final guide = gwaniMatches.isNotEmpty
        ? gwaniMatches.first
        : defaultMatches.isNotEmpty
            ? defaultMatches.first
            : support.isNotEmpty
                ? support.first
                : null;
    if (guide == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gwani is unavailable. Refresh and try again.')),
      );
      return;
    }

    setState(() => _starting = true);
    try {
      final chat = ref.read(aiChatProvider.notifier);
      chat.seedGreeting(
        guide.characterId,
        'Let’s create your Twin together. Reply by voice if you can. '
        'I will naturally use the language you use, so you never need to choose a language.',
      );
      await chat.sendAttachment(
        guide.characterId,
        ChatAttachment(kind: 'image', path: photo.path, name: photo.name),
        caption:
            'I want to create my Twin. Physical setup: gender $_gender, age $_age. '
            'This is the Twin profile photo. Please run a short voice-first interview now. '
            'Ask one simple question at a time about how my Twin should greet people, '
            'what it should help with, its personality and tone, useful knowledge, and important boundaries. '
            'Never ask me to choose a language. Always answer in the language I am currently using. '
            'When you have enough information, tell me clearly that my Twin is ready to be completed.',
      );
      if (!mounted) return;
      context.go(
        '/chat/${guide.characterId}?twinSetup=1&entry=live-talk'
        '&gender=${Uri.encodeQueryComponent(_gender)}'
        '&age=$_age'
        '&photo=${Uri.encodeQueryComponent(photo.path)}',
      );
    } finally {
      if (mounted) setState(() => _starting = false);
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
        title: const Text('Create your Twin'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
          children: [
            Text(
              'Three quick details, then just talk.',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: MasanawaTokens.fontSize['2xl'],
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              'Gwani will learn how your Twin should behave in a short voice interview. '
              'There is no language setting — Masanawa follows the language you use.',
              style: TextStyle(color: u.textMuted, height: 1.45),
            ),
            const SizedBox(height: 22),
            _SetupCard(
              icon: Icons.wc_outlined,
              title: 'Gender',
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'male', label: Text('Male'), icon: Icon(Icons.male)),
                  ButtonSegment(value: 'female', label: Text('Female'), icon: Icon(Icons.female)),
                ],
                selected: {_gender},
                onSelectionChanged: (value) => setState(() => _gender = value.first),
              ),
            ),
            const SizedBox(height: 12),
            _SetupCard(
              icon: Icons.cake_outlined,
              title: 'Age',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('$_age years', style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  )),
                  Slider(
                    value: _age.toDouble(),
                    min: 13,
                    max: 90,
                    divisions: 77,
                    label: '$_age',
                    onChanged: (value) => setState(() => _age = value.round()),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            _SetupCard(
              icon: Icons.account_circle_outlined,
              title: 'Twin photo',
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  radius: 30,
                  backgroundColor: u.brand.withValues(alpha: .10),
                  foregroundImage: _photo == null ? null : FileImage(File(_photo!.path)),
                  child: _photo == null ? Icon(Icons.add_a_photo_outlined, color: u.brand) : null,
                ),
                title: Text(_photo == null ? 'Add a profile photo' : _photo!.name),
                subtitle: const Text('This becomes the face people see for your Twin.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: _pickPhoto,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: u.brand.withValues(alpha: .08),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  Icon(Icons.graphic_eq, color: u.brand, size: 30),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Next: Gwani asks a few questions. Voice is preferred; text still works.',
                      style: TextStyle(color: u.textPrimary, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _starting ? null : _talkToGwani,
              icon: _starting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.mic_rounded),
              label: Text(_starting ? 'Opening Gwani…' : 'Talk to Gwani'),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(MasanawaTokens.radius['xl']!),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SetupCard extends StatelessWidget {
  const _SetupCard({required this.icon, required this.title, required this.child});
  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: u.surfaceCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, color: u.brand),
            const SizedBox(width: 9),
            Text(title, style: TextStyle(
              color: u.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            )),
          ]),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
