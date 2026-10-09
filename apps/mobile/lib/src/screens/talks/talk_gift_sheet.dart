import 'package:flutter/material.dart';

import '../../talks/talk_gift.dart';
import '../../theme/masanawa_theme.dart';
import 'talk_gift_stage_overlay.dart';

/// Catalog, identity and exact price are loaded from the signed-in Gateway.
/// Tapping an option selects it; only Send explicitly authorizes the transfer.
class TalkGiftSheet extends StatefulWidget {
  const TalkGiftSheet({
    super.key,
    required this.hostName,
    required this.loadCatalog,
    required this.onGift,
  });

  final String hostName;
  final Future<TalkGiftCatalog> Function() loadCatalog;
  final Future<bool> Function(TalkGiftCatalogItem item) onGift;

  @override
  State<TalkGiftSheet> createState() => _TalkGiftSheetState();
}

class _TalkGiftSheetState extends State<TalkGiftSheet> {
  late Future<TalkGiftCatalog> _catalogFuture;
  String? _selectedId;
  bool _sending = false;
  // A failed/uncertain settlement may have debited Credits. Never allow an
  // accidental second tap against the old catalog after an unknown result.
  // The authenticated transport retains the canonical pending request ID.
  bool _requiresCatalogRefresh = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _catalogFuture = widget.loadCatalog();
  }

  void _retry() {
    if (_sending) return;
    setState(() {
      _selectedId = null;
      _error = null;
      _requiresCatalogRefresh = false;
      _catalogFuture = widget.loadCatalog();
    });
  }

  Future<void> _send(TalkGiftCatalogItem option) async {
    if (_sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });

    var sent = false;
    try {
      sent = await widget.onGift(option);
    } catch (_) {
      sent = false;
    }

    if (!mounted) return;
    if (sent) {
      Navigator.of(context).pop(true);
      return;
    }

    setState(() {
      _sending = false;
      _requiresCatalogRefresh = true;
      _selectedId = null;
      _error = 'Couldn’t confirm this gift. Check Wallet history before retrying.';
      // A price/availability conflict should be resolved by explicitly reloading
      // the catalog, never by silently charging a different amount.
    });
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      child: SingleChildScrollView(
        child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 34,
              height: 4,
              decoration: BoxDecoration(
                color: u.structuralBorder,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Gift ${widget.hostName}',
              style: TextStyle(
                color: u.textPrimary, fontSize: 18, fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 5),
            Text('Send Credits to the Host.',
              style: TextStyle(color: u.textMuted, fontSize: 13)),
            const SizedBox(height: 16),
            FutureBuilder<TalkGiftCatalog>(
              future: _catalogFuture,
              builder: (context, snapshot) {
                if (!snapshot.hasData) {
                  if (snapshot.hasError) {
                    return Column(
                      children: [
                        const Text('Gift options are unavailable right now.'),
                        TextButton.icon(
                          key: const ValueKey('talk-gift-retry-catalog'),
                          onPressed: _retry,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Try again'),
                        ),
                      ],
                    );
                  }
                  return const Padding(
                    padding: EdgeInsets.all(18),
                    child: CircularProgressIndicator(),
                  );
                }
                final options = snapshot.data!.items;
                if (options.isEmpty) {
                  return Column(children: [
                    const Text('No gifts are available for this Talk right now.'),
                    TextButton(onPressed: _retry, child: const Text('Refresh')),
                  ]);
                }
                TalkGiftCatalogItem? selection;
                for (final item in options) {
                  if (item.id == _selectedId) selection = item;
                }

                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final option in options)
                          ChoiceChip(
                            key: ValueKey('talk-gift-${option.id}'),
                            avatar: Icon(
                              talkGiftIcon(option.visual),
                              size: 18,
                              color: u.brandStrong,
                            ),
                            label: Text(
                              '${option.name} · ${option.amountCredits} Cr',
                            ),
                            selected: _selectedId == option.id,
                            onSelected: _sending || _requiresCatalogRefresh
                                ? null
                                : (_) => setState(() {
                                      _selectedId = option.id;
                                      _error = null;
                                    }),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (selection != null)
                      Text(
                        '${selection.amountCredits} Credits to ${widget.hostName}. '
                        'This will be deducted from your Credits balance.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: u.textPrimary, fontSize: 13),
                      ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      Text(_error!,
                        key: const ValueKey('talk-gift-error'),
                        textAlign: TextAlign.center,
                        style: TextStyle(color: u.emergency, fontSize: 12.5)),
                      TextButton(
                        key: const ValueKey('talk-gift-refresh-price'),
                        onPressed: _sending ? null : _retry,
                        child: const Text('Refresh gift options'),
                      ),
                    ],
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        key: const ValueKey('talk-gift-send'),
                        onPressed: selection == null || _sending || _requiresCatalogRefresh
                            ? null
                            : () => _send(selection!),
                        child: _sending
                            ? const SizedBox(
                                width: 18, height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(selection == null
                                ? 'Choose a gift'
                                : 'Send ${selection.amountCredits} Credits gift'),
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
        ),
      ),
    );
  }
}

