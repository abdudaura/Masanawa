import 'package:flutter/material.dart';
import 'shell_document.dart';

/// Host-owned styling; server content cannot change native privileges.
class ShellDocumentView extends StatefulWidget {
  const ShellDocumentView({super.key, required this.document, this.onAction});
  final ShellDocument document;
  final ShellActionHandler? onAction;
  @override
  State<ShellDocumentView> createState() => _ShellDocumentViewState();
}

class _ShellDocumentViewState extends State<ShellDocumentView> {
  final _form = GlobalKey<FormState>();
  final _values = <String, String>{};
  bool _busy = false;
  bool _consumed = false;
  String? _error;
  @override
  void didUpdateWidget(covariant ShellDocumentView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.document.id != widget.document.id ||
        oldWidget.document.revision != widget.document.revision) {
      _values.clear();
      _consumed = false;
      _error = null;
    }
  }

  Future<void> _submit(ShellNode node) async {
    if (_busy || _consumed || widget.document.expired ||
        widget.onAction == null || !(_form.currentState?.validate() ?? false)) return;
    final document = widget.document;
    setState(() { _busy = true; _error = null; });
    try {
      await widget.onAction!(ShellAction(documentId: document.id,
        revision: document.revision, actionId: node.action!, token: node.token!,
        values: Map.unmodifiable(_values)));
      if (mounted && widget.document.id == document.id &&
          widget.document.revision == document.revision) {
        setState(() => _consumed = true);
      }
    } catch (_) {
      if (mounted && widget.document.id == document.id &&
          widget.document.revision == document.revision) {
        setState(() {
          _consumed = true;
          _error = 'Could not confirm this action. Ask for its status before continuing.';
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _node(ShellNode node) {
    final children = node.children.map(_node).toList();
    switch (node.type) {
      case 'text':
        return SelectableText(node.text ?? '');
      case 'heading':
        return Text(node.text ?? '', style: Theme.of(context).textTheme.titleMedium);
      case 'column':
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [for (final child in children) Padding(
            padding: const EdgeInsets.only(bottom: 8), child: child)]);
      case 'options':
        return Wrap(spacing: 8, runSpacing: 8, children: children);
      case 'card':
        return Card(child: Padding(padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children)));
      case 'input':
        return TextFormField(
          key: ValueKey('${widget.document.id}:${widget.document.revision}:${node.id}'),
          initialValue: _values[node.id] ?? '',
          maxLength: 512,
          decoration: InputDecoration(labelText: node.text ?? node.id),
          onChanged: (value) => _values[node.id!] = value,
          validator: (value) => node.requiredValue && (value?.trim().isEmpty ?? true)
            ? 'Please complete this field' : null);
      case 'button':
        return FilledButton(
          onPressed: _busy || _consumed || widget.document.expired ||
            widget.onAction == null ? null : () => _submit(node),
          child: Text(node.text ?? 'Choose'));
      case 'divider':
        return const Divider();
      default:
        return Text(node.text ?? 'This content is available in the conversation text.');
    }
  }

  @override
  Widget build(BuildContext context) => Form(key: _form,
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final node in widget.document.nodes) Padding(
        padding: const EdgeInsets.only(bottom: 8), child: _node(node)),
      if (_busy) const LinearProgressIndicator(),
      if (widget.document.expired) const Text('This option has expired. Ask for updated options.'),
      if (_consumed && _error == null) const Text('Selection submitted.'),
      if (_error != null) Text(_error!, style: TextStyle(
        color: Theme.of(context).colorScheme.error)),
    ]));
}
