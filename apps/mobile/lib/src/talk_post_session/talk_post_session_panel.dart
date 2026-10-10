import 'package:flutter/material.dart';
import 'talk_post_session.dart';

/// A nested, host-only review surface. Does not publish/modify replay or create
/// a paid Talk. The R17/C08 integrator is responsible for its route placement.
class TalkPostSessionPanel extends StatefulWidget {
  const TalkPostSessionPanel({super.key, required this.controller});
  final TalkInsightController controller;

  @override
  State<TalkPostSessionPanel> createState() => _TalkPostSessionPanelState();
}
class _TalkPostSessionPanelState extends State<TalkPostSessionPanel> {
  bool _consent = false;
  int? _consentOwnerRevision;
  @override
  void initState() {
    super.initState();
    widget.controller.refresh();
  }
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final controller = widget.controller;
        final draft = controller.draft;
        return ListView(children: [
          const ListTile(
            title: Text('Talk insights'),
            subtitle: Text('Private suggestions for the Host. Nothing is published or shared automatically.'),
          ),
          if (controller.state == TalkInsightUiState.loading)
            const ListTile(title: Text('Checking recording and insights…'),
              trailing: CircularProgressIndicator()),
          if (controller.state == TalkInsightUiState.unavailable)
            const ListTile(title: Text('No eligible recording'),
              subtitle: Text('Insights require a finished, retained recording with Host consent.')),
          if (controller.state == TalkInsightUiState.eligible)
            const ListTile(title: Text('Recording ready for private insights'),
              subtitle: Text('You can consent to generate a Host-only draft.')),
          if (controller.state == TalkInsightUiState.processing)
            const ListTile(title: Text('Processing recording'),
              subtitle: Text('Check again for the completed draft.')),
          if (controller.state == TalkInsightUiState.failed)
            ListTile(title: const Text('Insights unavailable'),
              subtitle: Text(controller.errorMessage ?? 'Generation failed. You may retry.')),
          if (draft != null && draft.status == TalkInsightStatus.ready) ...[
            ListTile(title: const Text('Summary (review before sharing)'),
              subtitle: SelectableText(draft.summary ?? '')),
            for (final item in draft.highlights)
              ListTile(leading: const Icon(Icons.check_circle_outline),
                title: SelectableText(item)),
            if (draft.nextTalkTitle != null)
              ListTile(title: const Text('Suggested next Talk title'),
                subtitle: SelectableText(draft.nextTalkTitle!)),
          ],
          if (controller.state == TalkInsightUiState.eligible ||
              controller.state == TalkInsightUiState.failed ||
              controller.state == TalkInsightUiState.processing)
            CheckboxListTile(
              value: _consent && _consentOwnerRevision == controller.ownerRevision,
              onChanged: controller.isCurrentOwner
                  ? (value) => setState(() {
                      _consent = value ?? false;
                      _consentOwnerRevision = _consent ? controller.ownerRevision : null;
                    })
                  : null,
              title: const Text('I consent to process this retained recording for a private draft'),
              subtitle: const Text('May use an external transcription/model provider. No public post is created.'),
              controlAffinity: ListTileControlAffinity.leading,
            ),
          Wrap(spacing: 8, children: [
            OutlinedButton(
              onPressed: controller.isCurrentOwner &&
                      controller.state != TalkInsightUiState.loading
                  ? controller.refresh : null,
              child: const Text('Check status'),
            ),
            if (controller.state == TalkInsightUiState.eligible ||
                controller.state == TalkInsightUiState.failed ||
                controller.state == TalkInsightUiState.processing)
              FilledButton(
                onPressed: _consent && _consentOwnerRevision == controller.ownerRevision &&
                        controller.isCurrentOwner &&
                        controller.state != TalkInsightUiState.loading
                    ? () {
                        setState(() {
                          _consent = false;
                          _consentOwnerRevision = null;
                        });
                        controller.generate(explicitConsent: true);
                      }
                    : null,
                child: const Text('Generate private draft'),
              ),
          ]),
        ]);
      },
    );
  }
}
