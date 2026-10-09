import 'package:flutter/material.dart';

import '../agents/clone_onboarding.dart';
import 'twin_training_flow.dart';

/// Nested Agents/My Twin interview. F12 owns its navigation insertion.
/// A voice adapter may supply recognized *user speech* only; never agent audio.
class TwinTrainingScreen extends StatefulWidget {
  const TwinTrainingScreen({
    super.key,
    required this.flow,
    this.onPrivateTest,
    this.onVoiceAnswer,
  });

  final TwinTrainingFlow flow;

  /// Must return true only after an authenticated owner preview conversation
  /// actually produced a canonical server response and cost was disclosed.
  final Future<bool> Function(String characterId)? onPrivateTest;
  final Future<String?> Function()? onVoiceAnswer;

  @override
  State<TwinTrainingScreen> createState() => _TwinTrainingScreenState();
}

class _TwinTrainingScreenState extends State<TwinTrainingScreen> {
  final TextEditingController _answer = TextEditingController();
  bool _publishConfirmed = false;

  @override
  void initState() {
    super.initState();
    // The controller is owned by the embedding route, not by this widget.
    widget.flow.reload();
  }

  @override
  void dispose() {
    _answer.dispose();
    super.dispose();
  }

  Future<void> _answerNow() async {
    final ok = await widget.flow.answer(_answer.text);
    if (ok && mounted) _answer.clear();
  }

  Future<void> _voice() async {
    final voice = widget.onVoiceAnswer;
    if (voice == null || widget.flow.busy) return;
    try {
      final recognized = await voice();
      if (!mounted || recognized == null) return;
      // Recognition is a draft until the owner submits it.
      _answer.text = recognized;
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Voice input unavailable. You can type instead.')),
      );
    }
  }

  Future<void> _test() async {
    final id = widget.flow.characterId;
    if (id == null || widget.onPrivateTest == null) return;
    try {
      final reviewed = await widget.onPrivateTest!(id);
      if (!mounted) return;
      setState(() => _publishConfirmed = false);
      widget.flow.setPrivateTestReviewed(reviewed);
      if (!reviewed) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Private test is not confirmed. Publishing is still disabled.')),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not verify the private test. No publication occurred.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final flow = widget.flow;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Train my AI Twin'),
        actions: [
          IconButton(
            tooltip: 'Reload saved Twin setup',
            onPressed: flow.busy ? null : flow.reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: flow,
        builder: (context, _) {
          final saved = flow.view;
          if (flow.busy && saved == null) {
            return const Center(child: CircularProgressIndicator());
          }
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Text('Only you can train your personal AI representative. '
                  'It is disclosed as AI, not as a real human. '
                  'Do not submit someone else’s identity or private files.'),
              const SizedBox(height: 16),
              if (flow.busy) const LinearProgressIndicator(),
              if (flow.error != null) ...[
                Semantics(
                  liveRegion: true,
                  child: Text(flow.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ),
                const SizedBox(height: 12),
              ],
              if (flow.requiresRefresh) ...[
                const Text('The latest server state is required before editing or publishing.'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: flow.busy ? null : flow.reload,
                  child: const Text('Reload saved setup'),
                ),
              ] else ...[
                Text(flow.question, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 14),
                if (saved?.profile != null) ...[
                  _SavedProfile(saved!.profile!),
                  const SizedBox(height: 14),
                ],
                if (flow.step.index <= TwinInterviewStep.style.index) ...[
                  TextField(
                    controller: _answer,
                    maxLines: flow.step == TwinInterviewStep.biography ? 4 : 2,
                    maxLength: flow.step == TwinInterviewStep.biography ? 1000 : 500,
                    textInputAction: TextInputAction.done,
                    decoration: InputDecoration(
                      border: const OutlineInputBorder(),
                      labelText: 'Your answer',
                      suffixIcon: IconButton(
                        tooltip: widget.onVoiceAnswer == null
                            ? 'Voice unavailable' : 'Dictate your answer',
                        onPressed: widget.onVoiceAnswer == null || flow.busy ? null : _voice,
                        icon: const Icon(Icons.mic_none),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: flow.busy ? null : _answerNow,
                    child: const Text('Save answer'),
                  ),
                ],
                if (!saved!.confirmed) ...[
                  const SizedBox(height: 14),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final stage in TwinInterviewStep.values.take(5))
                      ActionChip(
                        label: Text(switch (stage) {
                          TwinInterviewStep.name => 'Name',
                          TwinInterviewStep.languages => 'Languages',
                          TwinInterviewStep.biography => 'Experience',
                          TwinInterviewStep.expertise => 'Expertise',
                          _ => 'Style',
                        }),
                        onPressed: flow.busy ? null : () {
                          _answer.clear();
                          flow.choose(stage);
                        },
                      ),
                  ]),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('I am creating a Twin of myself or a person I am authorized to represent.'),
                    value: flow.consentToRepresentSelf,
                    onChanged: flow.busy ? null : (v) => flow.setConsent(v == true),
                  ),
                  if (saved.state != 'preview')
                    FilledButton.tonal(
                      onPressed: flow.busy || !flow.consentToRepresentSelf
                          ? null : flow.previewProfile,
                      child: const Text('Review profile before creation'),
                    ),
                  if (saved.state == 'preview')
                    FilledButton(
                      onPressed: flow.busy || !flow.consentToRepresentSelf
                          ? null : flow.confirmCreation,
                      child: const Text('Confirm and create my Twin'),
                    ),
                ],
                if (flow.step == TwinInterviewStep.recover)
                  FilledButton(
                    onPressed: flow.busy ? null : flow.confirmCreation,
                    child: const Text('Recover confirmed setup'),
                  ),
                if (flow.ready) ...[
                  const Text('Your Twin is created. A private test is different from '
                      'publishing. Costs, availability and actions depend on the real agent configuration.'),
                  const SizedBox(height: 10),
                  FilledButton.tonal(
                    onPressed: flow.busy || widget.onPrivateTest == null ? null : _test,
                    child: const Text('Test private Twin conversation'),
                  ),
                  if (widget.onPrivateTest == null)
                    const Text('Preview conversation is not connected; publishing is disabled.'),
                  CheckboxListTile(
                    title: const Text('Publish this AI Twin in the public directory'),
                    subtitle: const Text('Only after a confirmed private test and explicit approval.'),
                    value: _publishConfirmed,
                    onChanged: flow.reviewedPrivateTest && !flow.busy
                        ? (v) => setState(() => _publishConfirmed = v == true)
                        : null,
                  ),
                  FilledButton(
                    onPressed: flow.busy || !_publishConfirmed || !flow.reviewedPrivateTest
                        ? null
                        : () => flow.publish(explicitlyConfirmed: _publishConfirmed),
                    child: const Text('Publish Twin'),
                  ),
                ],
              ],
            ],
          );
        },
      ),
    );
  }
}

class _SavedLine extends StatelessWidget {
  const _SavedLine(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Text('$label: $value'),
  );
}

class _SavedProfile extends StatelessWidget {
  const _SavedProfile(this.profile);
  final CloneSetupProfile profile;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _SavedLine('Name', profile.displayName ?? 'Not yet set'),
      _SavedLine('Languages', profile.languages.join(', ')),
      _SavedLine('Experience', profile.biography),
      _SavedLine('Expertise', profile.expertise.join(', ')),
      _SavedLine('Style', profile.personality.join(', ')),
    ],
  );
}
