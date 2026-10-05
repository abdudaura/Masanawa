import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'shell_document.dart';
import 'shell_document_session.dart';

/// Mount inside a conversation bubble. The owning authenticated transport feeds
/// session.apply; the same document ID then changes in place as work progresses.
class ShellDocumentSessionView extends StatelessWidget {
  const ShellDocumentSessionView({
    super.key,
    required this.session,
    required this.documentId,
    this.onAction,
  });
  final ShellDocumentSession session;
  final String documentId;
  final ShellActionHandler? onAction;

  @override
  Widget build(BuildContext context) => StreamBuilder<void>(
    stream: session.changes,
    builder: (context, snapshot) {
      final update = session.read(documentId);
      if (update == null) return const SizedBox.shrink();
      final label = switch (update.phase) {
        ShellDocumentPhase.choosing => 'Choose an option',
        ShellDocumentPhase.submitted => 'Submitted',
        ShellDocumentPhase.processing => 'Processing',
        ShellDocumentPhase.fulfilled => 'Fulfilled',
        ShellDocumentPhase.failed => 'Failed',
        ShellDocumentPhase.cancelled => 'Cancelled',
      };
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(liveRegion: true, child: Text(label)),
          const SizedBox(height: 8),
          ShellDocumentView(
            key: ValueKey('${session.scope}:$documentId'),
            document: update.document,
            onAction: update.phase == ShellDocumentPhase.choosing
                ? onAction
                : null,
          ),
        ],
      );
    },
  );
}

class ShellDocumentView extends StatefulWidget {
  const ShellDocumentView({super.key, required this.document, this.onAction});
  final ShellDocument document;
  final ShellActionHandler? onAction;
  @override
  State<ShellDocumentView> createState() => _ShellDocumentViewState();
}

class _ShellDocumentViewState extends State<ShellDocumentView> {
  GlobalKey<FormState> _form = GlobalKey<FormState>();
  final _values = <String, String>{};
  bool _busy = false;
  bool _consumed = false;
  String? _error;
  int _generation = 0;
  Timer? _expiryTimer;
  bool get _disabled =>
      _busy || _consumed || widget.document.expired || widget.onAction == null;

  @override
  void initState() {
    super.initState();
    _scheduleExpiry();
  }

  void _scheduleExpiry() {
    _expiryTimer?.cancel();
    final expiry = widget.document.expiresAt;
    if (expiry == null) return;
    final delay = expiry.difference(DateTime.now());
    if (delay.isNegative) return;
    _expiryTimer = Timer(delay, () {
      if (mounted) setState(() {});
    });
  }

  @override
  void didUpdateWidget(covariant ShellDocumentView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.document.id != widget.document.id ||
        oldWidget.document.revision != widget.document.revision) {
      _generation++;
      _form = GlobalKey<FormState>();
      _values.clear();
      _busy = false;
      _consumed = false;
      _error = null;
    }
    _scheduleExpiry();
  }

  @override
  void dispose() {
    _expiryTimer?.cancel();
    super.dispose();
  }

  Future<void> _submit(ShellNode node) async {
    if (_disabled ||
        !widget.document.fullySupported ||
        !(_form.currentState?.validate() ?? false))
      return;
    final document = widget.document;
    final generation = _generation;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onAction!(
        ShellAction(
          documentId: document.id,
          revision: document.revision,
          nodeId: node.id!,
          actionId: node.action!,
          token: node.token!,
          values: Map.unmodifiable(_values),
        ),
      );
      if (mounted && _generation == generation) {
        setState(() => _consumed = true);
      }
    } catch (_) {
      if (mounted && _generation == generation) {
        setState(() {
          _consumed = true;
          _error = 'Could not confirm this action. Ask for its status before continuing.';
        });
      }
    } finally {
      if (mounted && _generation == generation) {
        setState(() => _busy = false);
      }
    }
  }

  Color _tone(String tone) {
    final colors = Theme.of(context).colorScheme;
    return switch (tone) {
      'error' => colors.error,
      'warning' => Colors.amber.shade800,
      'success' => Colors.green.shade700,
      _ => colors.primary,
    };
  }

  Widget _node(ShellNode node) {
    switch (node.type) {
      case 'text':
        return SelectableText(node.text ?? '');
      case 'heading':
        return Semantics(
          header: true,
          child: Text(
            node.text ?? '',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        );
      case 'column':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final child in node.children)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _node(child),
              ),
          ],
        );
      case 'options':
        return LayoutBuilder(
          builder: (context, constraints) => Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final child in node.children)
                ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: constraints.maxWidth),
                  child: _node(child),
                ),
            ],
          ),
        );
      case 'card':
        return Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final child in node.children)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _node(child),
                  ),
              ],
            ),
          ),
        );
      case 'metric':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              node.text ?? '',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            SelectableText(
              node.value ?? '',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            if (node.subtitle != null) Text(node.subtitle!),
          ],
        );
      case 'detail':
        return LayoutBuilder(
          builder: (context, constraints) {
            final label = Text(
              node.text ?? '',
              style: Theme.of(context).textTheme.bodySmall,
            );
            final rawValue = node.value ?? '';
            final uri = Uri.tryParse(rawValue);
            final isHttpsLink = uri != null &&
                uri.scheme == 'https' &&
                uri.host.isNotEmpty;
            final value = isHttpsLink
                ? Align(
                    alignment: Alignment.centerRight,
                    child: TextButton.icon(
                      onPressed: () async {
                        await launchUrl(
                          uri,
                          mode: LaunchMode.externalApplication,
                        );
                      },
                      icon: const Icon(Icons.open_in_new, size: 16),
                      label: Text(
                        uri.host,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                : SelectableText(rawValue);
            if (constraints.maxWidth < 280 ||
                MediaQuery.textScalerOf(context).scale(1) > 1.3) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [label, value],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: label),
                const SizedBox(width: 12),
                Expanded(child: value),
              ],
            );
          },
        );
      case 'progress':
        return Semantics(
          liveRegion: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(node.text ?? 'Working'),
              const SizedBox(height: 6),
              LinearProgressIndicator(value: node.progress),
              if (node.subtitle != null) Text(node.subtitle!),
            ],
          ),
        );
      case 'notice':
        return Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            border: Border.all(color: _tone(node.tone)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Semantics(
            liveRegion: true,
            child: Text(
              node.text ?? '',
              style: TextStyle(color: _tone(node.tone)),
            ),
          ),
        );
      case 'input':
        return TextFormField(
          key: ValueKey(
            '${widget.document.id}:${widget.document.revision}:${node.id}',
          ),
          initialValue: _values[node.id] ?? '',
          enabled: !_disabled,
          maxLength: 512,
          keyboardType: switch (node.inputKind) {
            'phone' => TextInputType.phone,
            'email' => TextInputType.emailAddress,
            'number' => const TextInputType.numberWithOptions(decimal: true),
            _ => TextInputType.text,
          },
          textInputAction: node.inputKind == 'search'
              ? TextInputAction.search
              : TextInputAction.next,
          decoration: InputDecoration(
            labelText: node.text ?? node.id,
            helperText: node.subtitle,
          ),
          onChanged: (value) => _values[node.id!] = value,
          validator: (value) =>
              node.requiredValue && (value?.trim().isEmpty ?? true)
              ? 'Please complete this field'
              : null,
        );
      case 'button':
        return FilledButton(
          onPressed: _disabled ? null : () => _submit(node),
          child: Text(node.text ?? 'Choose', textAlign: TextAlign.center),
        );
      case 'divider':
        return const Divider();
      default:
        return Text(widget.document.fallback);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.document.fullySupported) {
      return SelectableText(widget.document.fallback);
    }
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final node in widget.document.nodes)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _node(node),
            ),
          if (widget.onAction == null) Text(widget.document.fallback),
          if (_busy) const LinearProgressIndicator(),
          if (widget.document.expired)
            const Text('This option has expired. Ask for updated options.'),
          if (_consumed && _error == null) const Text('Selection submitted.'),
          if (_error != null)
            Semantics(
              liveRegion: true,
              child: Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
        ],
      ),
    );
  }
}
