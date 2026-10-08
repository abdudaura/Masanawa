import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'research.dart';

/// Nested Assistant research tool. F18 owns insertion into actual Assistant.
class ResearchPanel extends StatefulWidget {
  const ResearchPanel({super.key, required this.controller, this.openSource});
  final ResearchController controller;
  final Future<void> Function(Uri source)? openSource;
  @override
  State<ResearchPanel> createState() => _ResearchPanelState();
}

class _ResearchPanelState extends State<ResearchPanel> {
  final _text = TextEditingController();
  ResearchMode _mode = ResearchMode.general;
  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final state = widget.controller;
        final result = state.result;
        return SingleChildScrollView(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('Research with sources',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
            const Text('Search approved external indexes. Open original pages to check context.'),
            TextField(
              key: const ValueKey('research-query'),
              controller: _text,
              maxLength: 180,
              minLines: 1,
              maxLines: 3,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _search(),
              decoration: const InputDecoration(
                hintText: 'What would you like to research?',
                prefixIcon: Icon(Icons.manage_search),
              ),
            ),
            SegmentedButton<ResearchMode>(
              selected: {_mode},
              onSelectionChanged: state.loading
                  ? null
                  : (value) => setState(() => _mode = value.first),
              segments: const [
                ButtonSegment(value: ResearchMode.general, label: Text('General')),
                ButtonSegment(value: ResearchMode.current, label: Text('Current facts')),
              ],
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              key: const ValueKey('research-submit'),
              onPressed: state.loading ? null : _search,
              icon: const Icon(Icons.search),
              label: const Text('Find sources'),
            ),
            if (state.loading) ...[
              const LinearProgressIndicator(),
              const Semantics(label: 'Research in progress',
                  child: Text('Searching approved external sources...')),
            ],
            if (state.error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(state.error!, key: const ValueKey('research-error')),
              ),
            if (result != null) ...[
              const SizedBox(height: 12),
              if (result.status == ResearchStatus.insufficientEvidence)
                const Text('Not enough independent recent sources to verify current facts.',
                    key: ValueKey('research-insufficient')),
              if (result.status == ResearchStatus.noSources)
                const Text('No approved sources found.',
                    key: ValueKey('research-empty')),
              Text(result.caveat),
              const SizedBox(height: 8),
              for (final source in result.sources)
                Card(
                  child: ListTile(
                    key: ValueKey('source-' + source.referenceId),
                    title: Text(source.title),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(source.domain),
                        Text(source.excerpt),
                        if (source.publishedAt != null)
                          Text('Published: ' + source.publishedAt!.toIso8601String().substring(0, 10)),
                        const Text('Indexed excerpt; untrusted external text'),
                      ],
                    ),
                    trailing: const Icon(Icons.open_in_new),
                    onTap: () async {
                      try {
                        if (widget.openSource != null) {
                          await widget.openSource!(source.url);
                        } else {
                          await launchUrl(source.url, mode: LaunchMode.externalApplication);
                        }
                      } catch (_) {
                        // Failure never upgrades excerpts to verified evidence.
                      }
                    },
                  ),
                ),
            ],
          ],
        ));
      },
    );
  }

  void _search() {
    if (_text.text.trim().length < 3) return;
    widget.controller.search(_text.text, _mode);
  }
}
