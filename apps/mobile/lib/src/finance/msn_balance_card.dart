import 'package:flutter/material.dart';

import '../core/network/api_client.dart';
import 'msn_balance_transport.dart';

/// Customer-facing MSN readback. No fabricated zero, optimistic financial
/// updates or persistence of private balance data between accounts.
class MsnBalanceCard extends StatefulWidget {
  const MsnBalanceCard({
    super.key,
    required this.transport,
    required this.sessionIdentity,
  });

  final MsnBalanceTransport transport;

  /// Current mobile bearer session, passed only to fence in-flight reads when
  /// the user signs out or changes account; never rendered or logged.
  final String? sessionIdentity;

  @override
  State<MsnBalanceCard> createState() => _MsnBalanceCardState();
}

class _MsnBalanceCardState extends State<MsnBalanceCard> {
  MsnBalance? _balance;
  bool _loading = true;
  String? _error;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant MsnBalanceCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sessionIdentity != widget.sessionIdentity) {
      // Invalidate even a successful pending response from a prior account.
      _generation++;
      _balance = null;
      _error = null;
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
        _balance = null;
        _loading = false;
        _error = 'Sign in to view your MSN balance.';
      });
      return;
    }
    if (mounted) {
      setState(() {
        _balance = null;
        _loading = true;
        _error = null;
      });
    }
    try {
      final value = await widget.transport.read();
      if (!mounted ||
          generation != _generation ||
          session != widget.sessionIdentity) {
        return;
      }
      setState(() {
        _balance = value;
        _loading = false;
      });
    } catch (failure) {
      if (!mounted ||
          generation != _generation ||
          session != widget.sessionIdentity) {
        return;
      }
      setState(() {
        _balance = null;
        _loading = false;
        _error = failure is ApiException && failure.statusCode == 401
            ? 'Sign in again to view your MSN balance.'
            : failure is ApiException && failure.statusCode == 404
                ? 'MSN balance is not available yet.'
                : 'Balance is unavailable. Please retry.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Semantics(
          label: 'MSN wallet balance',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(Icons.account_balance_wallet_outlined),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('MSN · Masanawa', style: theme.textTheme.titleMedium),
                  ),
                  IconButton(
                    tooltip: 'Refresh MSN balance',
                    onPressed: _loading ? null : _load,
                    icon: const Icon(Icons.refresh),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (_loading)
                const LinearProgressIndicator()
              else if (_balance != null)
                SelectableText(
                  '${_balance!.displayAmount} MSN',
                  style: theme.textTheme.headlineSmall,
                )
              else
                Text(_error ?? 'Balance unavailable',
                    style: theme.textTheme.bodyMedium),
              const SizedBox(height: 6),
              Text(
                'MSN is separate from cryptocurrency. NGN deposits are funding, not held wallet balance.',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
