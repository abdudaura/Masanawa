import 'dart:math';
import 'package:flutter/material.dart';
import 'cases_api.dart';

/// C40–C42 Gwani support: route composition owned by AF00.
class GwaniCasesScreen extends StatefulWidget {
  const GwaniCasesScreen({
    super.key,
    required this.api,
    this.openSupportChat,
    this.initialTargetKind,
    this.initialTargetId,
  });
  final GwaniCasesApi api;
  final VoidCallback? openSupportChat;
  final String? initialTargetKind;
  final String? initialTargetId;
  @override
  State<GwaniCasesScreen> createState() => _GwaniCasesScreenState();
}

class _GwaniCasesScreenState extends State<GwaniCasesScreen> {
  late Future<List<Map<String, dynamic>>> _load = widget.api.mine();
  final _target = TextEditingController();
  final _details = TextEditingController();
  String _kind = 'comment';
  String _category = 'spam';
  bool _submitting = false;
  String? _error;
  String? _pendingRequestId;

  @override
  void initState() {
    super.initState();
    if (const ['post', 'comment', 'room_reply', 'video', 'transaction', 'account']
        .contains(widget.initialTargetKind)) {
      _kind = widget.initialTargetKind!;
    }
    _target.text = widget.initialTargetId ?? '';
  }

  @override
  void dispose() {
    _target.dispose();
    _details.dispose();
    super.dispose();
  }

  void _retry() => setState(() => _load = widget.api.mine());

  Future<void> _report() async {
    if (_target.text.trim().isEmpty || _submitting) return;
    // A failed request retains its key so a retry cannot duplicate the case.
    _pendingRequestId ??= 'report_${DateTime.now().microsecondsSinceEpoch}_${Random.secure().nextInt(1 << 30)}';
    setState(() { _submitting = true; _error = null; });
    try {
      final id = await widget.api.report(
        targetKind: _kind,
        targetId: _target.text.trim(),
        category: _category,
        details: _details.text.trim(),
        clientRequestId: _pendingRequestId!,
      );
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _pendingRequestId = null;
        _details.clear();
        _load = widget.api.mine();
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Report received: $id')));
      await _openCase(id);
    } catch (_) {
      if (mounted) setState(() {
        _submitting = false;
        _error = 'Could not submit. Check your connection and retry.';
      });
    }
  }

  Future<void> _openCase(String id) async {
    await Navigator.of(context).push<void>(MaterialPageRoute(
      builder: (_) => _GwaniCaseDetail(api: widget.api, caseId: id),
    ));
    if (mounted) _retry();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Gwani · Help and reports')),
    body: RefreshIndicator(
      onRefresh: () async { _retry(); await _load; },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Support, reporting and case updates',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (widget.openSupportChat != null)
            ListTile(
              leading: const Icon(Icons.chat_bubble_outline),
              title: const Text('Talk to Gwani'),
              subtitle: const Text('Ask for help or check your Bills and Wallet'),
              trailing: const Icon(Icons.chevron_right),
              onTap: widget.openSupportChat,
            ),
          const Divider(),
          const Text('Report a problem', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _kind,
            decoration: const InputDecoration(labelText: 'What are you reporting?'),
            items: const {
              'post': 'Post', 'comment': 'Comment', 'room_reply': 'Room reply',
              'video': 'Video', 'transaction': 'Transaction', 'account': 'Account'
            }.entries.map((entry) => DropdownMenuItem(
              value: entry.key, child: Text(entry.value),
            )).toList(),
            onChanged: _submitting ? null : (value) => setState(() {
              _kind = value ?? _kind;
              _pendingRequestId = null;
            }),
          ),
          TextField(
            controller: _target,
            enabled: !_submitting,
            maxLength: 128,
            onChanged: (_) => _pendingRequestId = null,
            decoration: const InputDecoration(
              labelText: 'Item reference', hintText: 'Use the report action on a post for automatic reference',
            ),
          ),
          DropdownButtonFormField<String>(
            initialValue: _category,
            decoration: const InputDecoration(labelText: 'Reason'),
            items: const ['spam', 'harassment', 'unsafe', 'copyright', 'fraud', 'other']
                .map((value) => DropdownMenuItem(value: value, child: Text(value))).toList(),
            onChanged: _submitting ? null : (value) => setState(() {
              _category = value ?? _category; _pendingRequestId = null;
            }),
          ),
          TextField(
            controller: _details, enabled: !_submitting,
            maxLines: 3, maxLength: 2000,
            onChanged: (_) => _pendingRequestId = null,
            decoration: const InputDecoration(labelText: 'Details (optional)'),
          ),
          if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          FilledButton.icon(
            onPressed: _submitting ? null : _report,
            icon: _submitting ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.flag_outlined),
            label: const Text('Submit report'),
          ),
          const SizedBox(height: 24),
          const Text('My cases', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _load,
            builder: (context, snapshot) {
              if (!snapshot.hasData && !snapshot.hasError) {
                return const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()));
              }
              if (snapshot.hasError) return ListTile(
                leading: const Icon(Icons.wifi_off),
                title: const Text('Cases unavailable'),
                subtitle: const Text('Your reports are safe. Retry when connected.'),
                trailing: TextButton(onPressed: _retry, child: const Text('Retry')),
              );
              final items = snapshot.data!;
              if (items.isEmpty) return const ListTile(title: Text('No cases yet'), subtitle: Text('Any reports you send will appear here.'));
              return Column(children: items.map((item) => ListTile(
                title: Text(item['category']?.toString() ?? 'Report'),
                subtitle: Text('${item['caseId']} · ${item['state']}'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openCase(item['caseId'] as String),
              )).toList());
            },
          ),
        ],
      ),
    ),
  );
}

class _GwaniCaseDetail extends StatefulWidget {
  const _GwaniCaseDetail({required this.api, required this.caseId});
  final GwaniCasesApi api;
  final String caseId;
  @override
  State<_GwaniCaseDetail> createState() => _GwaniCaseDetailState();
}

class _GwaniCaseDetailState extends State<_GwaniCaseDetail> {
  late Future<Map<String, dynamic>> _details = widget.api.detail(widget.caseId);
  final _appeal = TextEditingController();
  bool _sending = false;
  String? _error;
  @override
  void dispose() { _appeal.dispose(); super.dispose(); }
  Future<void> _sendAppeal() async {
    if (_sending || _appeal.text.trim().isEmpty) return;
    setState(() { _sending = true; _error = null; });
    try {
      await widget.api.appeal(widget.caseId, _appeal.text.trim());
      if (!mounted) return;
      setState(() { _sending = false; _details = widget.api.detail(widget.caseId); });
    } catch (_) {
      if (mounted) setState(() { _sending = false; _error = 'Unable to appeal. Please retry.'; });
    }
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.caseId)),
    body: FutureBuilder<Map<String, dynamic>>(
      future: _details,
      builder: (context, snapshot) {
        if (!snapshot.hasData && !snapshot.hasError) return const Center(child: CircularProgressIndicator());
        if (snapshot.hasError) return Center(child: TextButton(
          onPressed: () => setState(() => _details = widget.api.detail(widget.caseId)),
          child: const Text('Could not load case · Retry'),
        ));
        final value = snapshot.data!;
        final state = value['state']?.toString() ?? 'open';
        final events = (value['events'] as List<dynamic>? ?? const []);
        return ListView(padding: const EdgeInsets.all(16), children: [
          Text('Status: $state', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(value['details']?.toString() ?? ''),
          const Divider(),
          const Text('Timeline', style: TextStyle(fontWeight: FontWeight.bold)),
          if (events.isEmpty) const Text('Awaiting a case update'),
          for (final item in events)
            ListTile(
              leading: const Icon(Icons.history),
              title: Text((item as Map)['type']?.toString() ?? 'Updated'),
              subtitle: Text(item['createdAt']?.toString() ?? ''),
            ),
          if (['actioned', 'dismissed', 'closed'].contains(state)) ...[
            TextField(controller: _appeal, maxLength: 2000, maxLines: 3,
                decoration: const InputDecoration(labelText: 'Why should this be reconsidered?')),
            if (_error != null) Text(_error!),
            FilledButton(onPressed: _sending ? null : _sendAppeal, child: const Text('Submit appeal')),
          ],
        ]);
      },
    ),
  );
}
