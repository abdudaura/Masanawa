import 'package:flutter/material.dart';

import 'quick_start_copy.dart';

/// A reviewed destination and LOCAL unsent draft, never an approved action.
final class QuickStartLaunch {
  const QuickStartLaunch({required this.target, required this.unsentDraft});
  final QuickStartTarget target;
  final String unsentDraft;
}

/// Optional first-use guide; F12 owns mounting/routing. Never invokes model,
/// sends a message, starts a microphone, or spends. No stored first-run marker.
class ExperienceQuickStartGuide extends StatefulWidget {
  const ExperienceQuickStartGuide({
    super.key,
    required this.accountScope,
    required this.onOpen,
    this.onSkip,
    this.localeOverride,
  });
  /// Must change on logout/account switch; clears any staged personal draft.
  final String accountScope;
  final ValueChanged<QuickStartLaunch> onOpen;
  final VoidCallback? onSkip;
  /// Hausa copy is available locally; R11 still owns app-wide locale support.
  final Locale? localeOverride;

  @override
  State<ExperienceQuickStartGuide> createState() => _GuideState();
}

class _GuideState extends State<ExperienceQuickStartGuide> {
  QuickStartTarget? _selected;
  bool _reviewing = false;
  final TextEditingController _note = TextEditingController();

  @override
  void didUpdateWidget(covariant ExperienceQuickStartGuide oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountScope != widget.accountScope) {
      _selected = null;
      _reviewing = false;
      _note.clear();
    }
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final copy = QuickStartCopy.forLocale(
      widget.localeOverride ?? Localizations.localeOf(context),
    );
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(_reviewing ? copy.reviewTitle : copy.title),
        actions: [
          TextButton(onPressed: widget.onSkip, child: Text(copy.skip)),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: ListView(
                    key: const ValueKey('u19-guide-scroll'),
                    padding: const EdgeInsets.all(16),
                    children: _reviewing
                        ? _reviewChildren(copy, scheme)
                        : _chooseChildren(copy, scheme),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  child: Row(
                    children: [
                      if (_reviewing) ...[
                        OutlinedButton(
                          key: const ValueKey('u19-back'),
                          onPressed: () => setState(() => _reviewing = false),
                          child: Text(copy.back),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        child: FilledButton(
                          key: const ValueKey('u19-continue'),
                          onPressed: _selected == null
                              ? null
                              : () {
                                  if (!_reviewing) {
                                    setState(() => _reviewing = true);
                                    return;
                                  }
                                  widget.onOpen(QuickStartLaunch(
                                    target: _selected!,
                                    unsentDraft: _note.text.trim(),
                                  ));
                                },
                          child: Text(_reviewing ? copy.open : copy.choose),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _chooseChildren(QuickStartCopy copy, ColorScheme scheme) => [
        Text(copy.explanation, style: const TextStyle(fontSize: 16)),
        const SizedBox(height: 20),
        Text(copy.sectionLabel,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        const SizedBox(height: 8),
        for (final target in QuickStartTarget.values)
          Semantics(
            button: true,
            selected: _selected == target,
            label: copy.targetTitle(target),
            hint: copy.targetDetail(target),
            child: Card(
              child: ListTile(
                key: ValueKey('u19-target-' + target.name),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                minTileHeight: 56,
                leading: Icon(_iconFor(target),
                    color: _selected == target ? scheme.primary : null),
                title: Text(copy.targetTitle(target)),
                subtitle: Text(copy.targetDetail(target)),
                trailing: _selected == target
                    ? const Icon(Icons.check_circle_outline) : null,
                onTap: () => setState(() => _selected = target),
              ),
            ),
          ),
        const SizedBox(height: 16),
        TextField(
          key: const ValueKey('u19-draft'),
          controller: _note,
          maxLines: 3,
          minLines: 1,
          maxLength: 512,
          textInputAction: TextInputAction.done,
          decoration: InputDecoration(
            labelText: copy.draftLabel,
            helperText: copy.draftHint,
            border: const OutlineInputBorder(),
          ),
        ),
      ];

  List<Widget> _reviewChildren(QuickStartCopy copy, ColorScheme scheme) => [
        Text(copy.reviewExplanation, style: const TextStyle(fontSize: 16)),
        const SizedBox(height: 20),
        if (_selected != null)
          ListTile(
            leading: Icon(_iconFor(_selected!), color: scheme.primary),
            title: Text(copy.targetTitle(_selected!)),
            subtitle: Text(copy.targetDetail(_selected!)),
          ),
        if (_note.text.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          SelectableText(_note.text.trim()),
          const SizedBox(height: 8),
          Text(copy.noteNotice),
        ],
      ];

  static IconData _iconFor(QuickStartTarget target) => switch (target) {
        QuickStartTarget.talks => Icons.record_voice_over_outlined,
        QuickStartTarget.chats => Icons.chat_bubble_outline,
        QuickStartTarget.assistant => Icons.smart_toy_outlined,
        QuickStartTarget.wallet => Icons.account_balance_wallet_outlined,
        QuickStartTarget.agents => Icons.people_outline,
      };
}
