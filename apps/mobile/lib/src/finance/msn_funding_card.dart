import 'package:flutter/material.dart';
import '../core/network/api_client.dart';
import 'msn_funding_transport.dart';

/// Qualified-only, read-only funding history; no optimistic credit and no
/// second customer balance. Mounted behind a separate OFF-by-default flag.
class MsnFundingCard extends StatefulWidget {
  const MsnFundingCard({
    super.key,
    required this.transport,
    required this.sessionIdentity,
  });

  final MsnFundingTransport transport;
  final String? sessionIdentity;

  @override
  State<MsnFundingCard> createState() => _MsnFundingCardState();
}

class _MsnFundingCardState extends State<MsnFundingCard> {
  List<MsnFundingOperation>? _operations;
  bool _loading = true;
  String? _message;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant MsnFundingCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sessionIdentity != widget.sessionIdentity ||
        oldWidget.transport != widget.transport) {
      _generation++;
      _operations = null;
      _message = null;
      _loading = true;
      _load();
    }
  }

  Future<void> _load() async {
    final generation = ++_generation;
    final session = widget.sessionIdentity;
    if (session == null || session.trim().isEmpty) {
      if (!mounted) return;
      setState(() {
        _operations = null;
        _loading = false;
        _message = 'Sign in to view your MSN funding.';
      });
      return;
    }
    if (mounted) {
      setState(() {
        _operations = null;
        _loading = true;
        _message = null;
      });
    }
    try {
      final result = await widget.transport.read();
      if (!mounted || generation != _generation ||
          session != widget.sessionIdentity) {
        return;
      }
      setState(() {
        _loading = false;
        _operations = result;
      });
    } catch (error) {
      if (!mounted || generation != _generation ||
          session != widget.sessionIdentity) {
        return;
      }
      setState(() {
        _loading = false;
        _operations = null;
        _message = error is ApiException && error.statusCode == 404
            ? 'MSN funding is not available yet.'
            : error is ApiException && error.statusCode == 401
                ? 'Sign in again to view MSN funding.'
                : 'Funding history is unavailable. Please retry.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Semantics(
          label: 'MSN funding history',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                const Icon(Icons.receipt_long_outlined),
                const SizedBox(width: 10),
                Expanded(child: Text('MSN funding',
                    style: t.textTheme.titleMedium)),
                IconButton(
                  tooltip: 'Refresh MSN funding',
                  onPressed: _loading ? null : _load,
                  icon: const Icon(Icons.refresh),
                ),
              ]),
              const SizedBox(height: 8),
              if (_loading)
                const LinearProgressIndicator()
              else if (_operations == null)
                Text(_message ?? 'Funding status unavailable.')
              else if (_operations!.isEmpty)
                const Text('No MSN funding operations yet.')
              else
                ..._operations!.map((operation) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(operation.statusLabel, style: t.textTheme.bodyMedium),
                      const SizedBox(height: 4),
                      SelectableText(
                        operation.issuedAmount == null
                            ? 'Reference: ${operation.quoteId}'
                            : '${operation.issuedAmount} MSN issued · ${operation.quoteId}',
                        textDirection: TextDirection.ltr,
                        style: t.textTheme.bodySmall,
                      ),
                      const Divider(height: 12),
                    ],
                  ),
                )),
              const SizedBox(height: 4),
              Text(
                'Verified fiat payments are not MSN until backing and issuance are confirmed.',
                style: t.textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
