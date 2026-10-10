import 'package:flutter/material.dart';
import '../core/network/api_client.dart';

/// Uses the existing canonical TalkSafetyService through the authenticated
/// published-audio Gateway adapter; it does not create another report store.
abstract class PublishedAudioReportTransport {
  Future<String> submit({
    required String postId,
    required String reason,
    required String clientRequestId,
    String? detail,
  });
}

class GatewayPublishedAudioReportTransport implements PublishedAudioReportTransport {
  const GatewayPublishedAudioReportTransport(this.api);
  final ApiClient api;

  @override
  Future<String> submit({
    required String postId,
    required String reason,
    required String clientRequestId,
    String? detail,
  }) async {
    final response = await api.dio.post<dynamic>(
      '/audio-posts/${Uri.encodeComponent(postId)}/report',
      data: {
        'reason': reason,
        'clientRequestId': clientRequestId,
        if (detail != null && detail.trim().isNotEmpty) 'detail': detail.trim(),
      },
    );
    final value = response.data;
    if (value is! Map || value['accepted'] != true ||
        value['reportId'] is! String || (value['reportId'] as String).isEmpty) {
      throw const FormatException('Report submission was not confirmed');
    }
    return value['reportId'] as String;
  }
}

const publishedAudioReportReasons = <String, String>{
  'spam': 'Spam',
  'harassment': 'Harassment',
  'hate': 'Hate',
  'sexual': 'Sexual content',
  'violence': 'Violence',
  'self-harm': 'Self-harm',
  'fraud': 'Fraud or scam',
  'impersonation': 'Impersonation',
  'privacy': 'Privacy',
  'other': 'Other',
};

/// Explicit user submission, visible retry and no optimistic report success.
/// AF00 mounts this action on Published Audio Talk cards after registering its
/// canonical session-fenced Gateway route (never on a legacy live Talk card).
class AudioPostReportAction extends StatelessWidget {
  const AudioPostReportAction({
    super.key,
    required this.postId,
    required this.transport,
    this.enabled = true,
    this.isAuthorized,
  });
  final String postId;
  final PublishedAudioReportTransport transport;
  final bool enabled;
  /// Live session predicate. A report dialog must not outlive its account.
  final bool Function()? isAuthorized;

  @override
  Widget build(BuildContext context) => TextButton.icon(
    onPressed: !enabled || (isAuthorized != null && !isAuthorized!()) ? null : () async {
      final success = await showDialog<bool>(
        context: context,
        builder: (_) => _PublishedAudioReportDialog(
          postId: postId,
          transport: transport,
          isAuthorized: isAuthorized,
        ),
      );
      if (context.mounted && success == true &&
          (isAuthorized == null || isAuthorized!())) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report received for review.')),
        );
      }
    },
    icon: const Icon(Icons.flag_outlined),
    label: const Text('Report Talk'),
  );
}

class _PublishedAudioReportDialog extends StatefulWidget {
  const _PublishedAudioReportDialog({
    required this.postId,
    required this.transport,
    this.isAuthorized,
  });
  final String postId;
  final PublishedAudioReportTransport transport;
  final bool Function()? isAuthorized;

  @override
  State<_PublishedAudioReportDialog> createState() =>
      _PublishedAudioReportDialogState();
}

class _PublishedAudioReportDialogState extends State<_PublishedAudioReportDialog> {
  final TextEditingController _detail = TextEditingController();
  String _reason = 'spam';
  String? _requestKey;
  String? _error;
  bool _sending = false;
  int _nonce = 0;

  @override
  void dispose() {
    _detail.dispose();
    super.dispose();
  }

  void _changeReason(String? value) {
    if (value == null || _sending) return;
    setState(() {
      _reason = value;
      _requestKey = null;
      _error = null;
    });
  }

  Future<void> _submit() async {
    if (_sending) return;
    if (widget.isAuthorized != null && !widget.isAuthorized!()) {
      setState(() => _error = 'Account changed. Close this report and reopen it.');
      return;
    }
    final detail = _detail.text.trim();
    if (detail.length > 400) {
      setState(() => _error = 'Details must be 400 characters or fewer.');
      return;
    }
    // A retry after an uncertain HTTP result uses the SAME canonical
    // idempotency key. Changing the report reason/details resets that key.
    _requestKey ??=
        'audio-report-${DateTime.now().microsecondsSinceEpoch}-${_nonce++}';
    final requestKey = _requestKey!;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.transport.submit(
        postId: widget.postId,
        reason: _reason,
        clientRequestId: requestKey,
        detail: detail.isEmpty ? null : detail,
      );
      if (mounted && (widget.isAuthorized == null || widget.isAuthorized!())) {
        Navigator.of(context).pop(true);
      } else if (mounted) {
        setState(() {
          _sending = false;
          _error = 'Account changed. Close this report and reopen it.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _sending = false;
          _error = 'Report not confirmed. Retry safely or cancel.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Report this Talk'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Tell us why this published audio should be reviewed.'),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            decoration: const InputDecoration(labelText: 'Reason'),
            items: publishedAudioReportReasons.entries.map((entry) =>
              DropdownMenuItem(value: entry.key, child: Text(entry.value)),
            ).toList(),
            onChanged: _sending ? null : _changeReason,
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _detail,
            enabled: !_sending,
            maxLines: 3,
            maxLength: 400,
            decoration: const InputDecoration(
              labelText: 'Additional details (optional)',
            ),
            onChanged: (_) {
              _requestKey = null;
              if (_error != null) setState(() => _error = null);
            },
          ),
          if (_error != null)
            Text(_error!, style: TextStyle(
              color: Theme.of(context).colorScheme.error,
            )),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: _sending ? null : () => Navigator.of(context).pop(false),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: _sending ? null : _submit,
        child: Text(_sending ? 'Sending…' : 'Submit report'),
      ),
    ],
  );
}
