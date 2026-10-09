import 'package:flutter/material.dart';

import 'host_preparation.dart';
import 'host_preparation_controller.dart';

/// Nested Talks screen. The shell owner supplies account-fenced controller and
/// reopens by prepId after restart. Opening this screen NEVER publishes a Talk.
class TalkHostPreparationScreen extends StatefulWidget {
  const TalkHostPreparationScreen({
    super.key,
    required this.controller,
    required this.transport,
    this.prepId,
  });

  final HostPreparationController controller;
  final HostPreparationTransport transport;
  final String? prepId;

  @override
  State<TalkHostPreparationScreen> createState() =>
      _TalkHostPreparationScreenState();
}

class _TalkHostPreparationScreenState extends State<TalkHostPreparationScreen> {
  final _title = TextEditingController();
  final _topic = TextEditingController();
  final _questions = TextEditingController();
  bool _editing = false;
  bool _loadingExperts = false;
  List<Map<String, dynamic>> _experts = const [];
  Map<String, dynamic>? _quote;
  String? _previewError;
  String? _shownPrepId;
  int? _shownRevision;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onUpdated);
    if (widget.prepId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.controller.load(widget.prepId!);
      });
    }
  }

  void _onUpdated() {
    if (!mounted) return;
    final draft = widget.controller.draft;
    if (draft == null && _shownPrepId != null) {
      _shownPrepId = null;
      _shownRevision = null;
      _title.clear();
      _topic.clear();
      _questions.clear();
      _editing = false;
      _experts = const [];
      _quote = null;
      _previewError = null;
    }
    if (draft != null &&
        (draft.prepId != _shownPrepId || draft.revision != _shownRevision)) {
      _shownPrepId = draft.prepId;
      _shownRevision = draft.revision;
      _title.text = draft.title;
      _topic.text = draft.topic;
      _questions.text = draft.questions.join('\n');
      _editing = false;
      _experts = const [];
      _quote = null;
    }
    setState(() {});
  }

  List<String> _questionLines() => _questions.text
      .split('\n')
      .map((text) => text.trim())
      .where((text) => text.isNotEmpty)
      .toList(growable: false);

  Future<void> _save() async {
    final title = _title.text.trim();
    final topic = _topic.text.trim();
    final questions = _questionLines();
    if (title.isEmpty || topic.isEmpty || title.length > 160 ||
        topic.length > 240 || questions.length > 8 ||
        questions.any((q) => q.length > 240)) {
      setState(() => _previewError =
          'Enter a title and topic, with at most 8 questions (240 characters each).');
      return;
    }
    setState(() => _previewError = null);
    if (widget.controller.draft == null) {
      await widget.controller.create(
        title: title, topic: topic, questions: questions);
    } else {
      await widget.controller.save(
        title: title, topic: topic, questions: questions);
    }
  }

  Future<void> _confirmGoLive() async {
    if (!widget.controller.mayGoLive || _editing) return;
    final draft = widget.controller.draft!;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Start this public Talk?'),
        content: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(draft.title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(draft.topic),
              const SizedBox(height: 12),
              const Text('Going live makes the Talk public immediately. '
                  'No Experts or people will be invited automatically. '
                  'Paid AI Seats require a separate reviewed quote and confirmation.'),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep draft')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Go Live')),
        ],
      ),
    );
    if (!mounted || accepted != true) return;
    await widget.controller.goLiveAfterReview();
  }

  Future<void> _loadExperts() async {
    final draft = widget.controller.draft;
    if (draft == null || draft.phase != HostPreparationPhase.published) return;
    setState(() {
      _loadingExperts = true;
      _previewError = null;
      _experts = const [];
      _quote = null;
    });
    try {
      final experts = await widget.transport.experts(draft.prepId);
      if (!mounted || widget.controller.draft?.prepId != draft.prepId) return;
      setState(() => _experts = experts.where((e) => e['isAvailable'] == true)
          .take(30).toList(growable: false));
    } catch (_) {
      if (mounted) setState(() =>
          _previewError = 'Available Experts could not be verified.');
    } finally {
      if (mounted) setState(() => _loadingExperts = false);
    }
  }

  Future<void> _quoteExpert(Map<String, dynamic> expert) async {
    final draft = widget.controller.draft;
    final personaId = expert['personaId'];
    if (draft == null || personaId is! String) return;
    setState(() {
      _previewError = null;
      _quote = null;
    });
    try {
      final quote = await widget.transport.quoteExpert(draft.prepId, personaId);
      if (!mounted || widget.controller.draft?.prepId != draft.prepId) return;
      setState(() => _quote = quote);
    } catch (_) {
      if (mounted) setState(() =>
          _previewError = 'Quote unavailable. No Credits were charged.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final draft = controller.draft;
    final published = draft?.phase == HostPreparationPhase.published;
    final pending = draft?.phase == HostPreparationPhase.publishing;
    final busy = controller.busy;
    final canEdit = !busy &&
        (draft == null || draft.phase == HostPreparationPhase.draft);
    return Scaffold(
      appBar: AppBar(title: const Text('Prepare a Talk')),
      body: SafeArea(child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Write the topic and talking points privately. '
              'Nothing becomes public until you confirm Go Live.',
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          TextField(controller: _title, enabled: canEdit,
            onChanged: (_) => setState(() => _editing = true),
            maxLength: 160, textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Talk title')),
          TextField(controller: _topic, enabled: canEdit,
            onChanged: (_) => setState(() => _editing = true),
            maxLength: 240, maxLines: 3, minLines: 1,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Topic')),
          TextField(controller: _questions, enabled: canEdit,
            maxLines: 5, minLines: 2,
            decoration: const InputDecoration(
              labelText: 'Questions to discuss (one per line)',
              helperText: 'Optional; up to 8 questions',
            ),
            onChanged: (_) { if (!_editing) setState(() => _editing = true); }),
          if (_previewError != null) Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(_previewError!, style: TextStyle(
              color: Theme.of(context).colorScheme.error)),
          ),
          if (controller.error != null) Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(controller.error!, style: TextStyle(
              color: Theme.of(context).colorScheme.error)),
          ),
          const SizedBox(height: 8),
          if (busy) const LinearProgressIndicator(),
          if (canEdit)
            FilledButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.save_outlined),
              label: Text(draft == null ? 'Save private draft' : 'Save changes'),
            ),
          if (draft != null) ...[
            const SizedBox(height: 8),
            SelectableText('Draft ID: ${draft.prepId}'),
            const SizedBox(height: 12),
            if (!published && !pending)
              OutlinedButton.icon(
                onPressed: controller.mayGoLive && !_editing
                    ? _confirmGoLive : null,
                icon: const Icon(Icons.record_voice_over_outlined),
                label: const Text('Review and Go Live'),
              ),
            if (!published)
              OutlinedButton.icon(
                onPressed: busy ? null : controller.verifyPublication,
                icon: const Icon(Icons.refresh),
                label: const Text('Check publication status'),
              ),
            if (pending || controller.publicationNeedsReadback)
              const Text('The last publication is being reconciled. '
                  'Do not start a second Talk.'),
            if (published) ...[
              const Text('Your Talk is now live.'),
              SelectableText('Talk ID: ${draft.talkId ?? ''}'),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _loadingExperts ? null : _loadExperts,
                icon: const Icon(Icons.people_outline),
                label: const Text('View available Experts'),
              ),
              if (_loadingExperts) const LinearProgressIndicator(),
              if (!_loadingExperts && _experts.isEmpty)
                const Text('No verified available Experts loaded.'),
              for (final expert in _experts)
                ListTile(
                  title: Text(expert['displayName']?.toString() ?? 'Expert'),
                  subtitle: Text(expert['seatFeeLabel']?.toString() ?? ''),
                  trailing: TextButton(
                    onPressed: () => _quoteExpert(expert),
                    child: const Text('Preview price'),
                  ),
                ),
              if (_quote != null) ...[
                const Divider(),
                Text('Quote: ${_quote!['totalLabel'] ?? 'Unavailable'}'),
                Text('Expires: ${_quote!['expiresAt'] ?? ''}'),
                const Text('Price preview only. This screen cannot confirm '
                    'a charge or add an Expert. Use the separate Host approval flow.'),
              ],
            ],
          ],
        ],
      )),
    );
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onUpdated);
    _title.dispose();
    _topic.dispose();
    _questions.dispose();
    super.dispose();
  }
}
