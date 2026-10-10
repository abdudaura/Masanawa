import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/talk_ai_seat_state.dart';
import '../../state/session_state.dart';
import '../../talks/talk_ai_seat.dart';
import '../../theme/masanawa_theme.dart';

Future<TalkAiSeatRequest?> showAddAiSeatSheet(
  BuildContext context, {
  required String talkId,
  required bool isHost,
  TalkAiPersonaKind initialKind = TalkAiPersonaKind.expert,
  bool onlyOwnedTwin = false,
}) {
  return showModalBottomSheet<TalkAiSeatRequest>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => FractionallySizedBox(
      heightFactor: .92,
      child: AddAiSeatSheet(
        talkId: talkId,
        isHost: isHost,
        initialKind: initialKind,
        onlyOwnedTwin: onlyOwnedTwin,
      ),
    ),
  );
}

class AddAiSeatSheet extends ConsumerStatefulWidget {
  const AddAiSeatSheet({
    super.key,
    required this.talkId,
    required this.isHost,
    this.initialKind = TalkAiPersonaKind.expert,
    this.onlyOwnedTwin = false,
  });

  final String talkId;
  final bool isHost;
  final TalkAiPersonaKind initialKind;
  final bool onlyOwnedTwin;

  @override
  ConsumerState<AddAiSeatSheet> createState() => _AddAiSeatSheetState();
}

class _AddAiSeatSheetState extends ConsumerState<AddAiSeatSheet>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final _search = TextEditingController();
  TalkAiSeatQuote? _quote;
  TalkAiSeatCandidate? _selectedCandidate;
  Timer? _quoteExpiryTimer;
  bool _quoteExpired = false;
  bool _terminalQuote = false;
  bool _loadingQuote = false;
  bool _confirming = false;
  String? _error;
  String? _openingAccountId;
  int _authRevision = 0;

  String? _activeAccountId() {
    final session = ref.read(sessionProvider);
    return session is SessionSignedIn && session.user.isActive
        ? session.user.id
        : null;
  }

  bool _sameAccount(int revision) =>
      mounted &&
      revision == _authRevision &&
      _openingAccountId != null &&
      _activeAccountId() == _openingAccountId;

  @override
  void initState() {
    super.initState();
    _openingAccountId = _activeAccountId();
    _tabs = TabController(
      length: widget.onlyOwnedTwin ? 1 : 2,
      vsync: this,
      initialIndex: widget.onlyOwnedTwin ||
              widget.initialKind == TalkAiPersonaKind.expert ? 0 : 1,
    );
    _tabs.addListener(() {
      if (!_tabs.indexIsChanging) setState(() {});
    });
  }

  @override
  void dispose() {
    _quoteExpiryTimer?.cancel();
    _tabs.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _select(TalkAiSeatCandidate candidate) async {
    final revision = _authRevision;
    if (_loadingQuote || !_sameAccount(revision)) return;
    setState(() {
      _loadingQuote = true;
      _error = null;
    });
    try {
      final quote = await ref.read(talkAiSeatTransportProvider).createQuote(
            talkId: widget.talkId,
            personaId: candidate.personaId,
            mode:
                widget.isHost ? TalkAiSeatMode.hostAdd : TalkAiSeatMode.sponsor,
          );
      if (!_sameAccount(revision)) return;
      if (quote.personaId != candidate.personaId ||
          quote.kind != candidate.kind ||
          quote.quoteId.trim().isEmpty ||
          quote.totalLabel.trim().isEmpty ||
          quote.requiresHostApproval != !widget.isHost ||
          quote.mode != (widget.isHost
              ? TalkAiSeatMode.hostAdd
              : TalkAiSeatMode.sponsor) ||
          quote.isExpiredAt(DateTime.now())) {
        throw const FormatException('AI Seat quote is stale or mismatched');
      }
      _quoteExpiryTimer?.cancel();
      final untilExpiry = quote.expiresAt.difference(DateTime.now());
      setState(() {
        _selectedCandidate = candidate;
        _quote = quote;
        _quoteExpired = false;
        _terminalQuote = false;
      });
      if (untilExpiry > Duration.zero) {
        _quoteExpiryTimer = Timer(untilExpiry, () {
          if (mounted && _quote?.quoteId == quote.quoteId) {
            setState(() => _quoteExpired = true);
          }
        });
      }
    } catch (_) {
      if (!_sameAccount(revision)) return;
      setState(() {
        _error = 'Couldn’t prepare this Seat right now.';
      });
    } finally {
      if (_sameAccount(revision)) setState(() => _loadingQuote = false);
    }
  }

  Future<void> _refreshQuote() async {
    final candidate = _selectedCandidate;
    if (candidate == null || _loadingQuote || _confirming) return;
    await _select(candidate);
  }

  Future<void> _confirm() async {
    final revision = _authRevision;
    final quote = _quote;
    if (quote == null || _confirming || _loadingQuote ||
        !_sameAccount(revision)) return;
    if (_terminalQuote) {
      setState(() => _error = 'This request has ended. Get a new quote to continue.');
      return;
    }
    if (_quoteExpired || quote.isExpiredAt(DateTime.now())) {
      setState(() => _error = 'Quote expired. Get a new quote before confirming.');
      return;
    }
    setState(() {
      _confirming = true;
      _error = null;
    });
    try {
      final request = await ref.read(talkAiSeatTransportProvider).confirmQuote(
            talkId: widget.talkId,
            quoteId: quote.quoteId,
          );
      if (!_sameAccount(revision)) return;
      if (request.status == TalkAiSeatRequestStatus.expired ||
          request.status == TalkAiSeatRequestStatus.declined ||
          request.status == TalkAiSeatRequestStatus.unknown) {
        if (request.status != TalkAiSeatRequestStatus.unknown) {
          _quoteExpiryTimer?.cancel();
        }
        setState(() {
          _terminalQuote = request.status == TalkAiSeatRequestStatus.expired ||
              request.status == TalkAiSeatRequestStatus.declined;
          _error = request.message.isEmpty
              ? 'This Seat request could not be completed. Check its status.'
              : request.message;
        });
        return;
      }
      Navigator.of(context).pop(request);
    } catch (_) {
      if (!_sameAccount(revision)) return;
      setState(() {
        _error = 'Couldn’t verify this Seat request. Check the Talk or retry this same quote; don’t start a new purchase.';
      });
    } finally {
      if (_sameAccount(revision)) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // A quoted or even in-flight charge belongs to the account which opened
    // this picker. Never present its details or outcome under another login.
    ref.listen<String?>(
      sessionProvider.select((session) =>
          session is SessionSignedIn && session.user.isActive
              ? session.user.id
              : null),
      (previous, next) {
        if (!mounted || next == _openingAccountId) return;
        _quoteExpiryTimer?.cancel();
        setState(() {
          _authRevision++;
          _quote = null;
          _selectedCandidate = null;
          _quoteExpired = false;
          _terminalQuote = false;
          _loadingQuote = false;
          _confirming = false;
          _error = 'Account changed. Reopen Add AI to get a new quote.';
        });
        // A standalone sheet embedded in test/demo navigation has no modal to
        // dismiss; the actual payment-capable modal is closed after the frame.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          final route = ModalRoute.of(context);
          if (route is ModalBottomSheetRoute && route.isCurrent) {
            Navigator.of(context).pop();
          }
        });
      },
    );
    final u = context.masanawa;
    final quote = _quote;
    if (quote != null) {
      return _QuoteConfirmation(
        quote: quote,
        isHost: widget.isHost,
        confirming: _confirming,
        refreshing: _loadingQuote,
        expired: _quoteExpired || quote.isExpiredAt(DateTime.now()),
        terminal: _terminalQuote,
        error: _error,
        onBack: () {
          _quoteExpiryTimer?.cancel();
          setState(() {
            _quote = null;
            _quoteExpired = false;
            _terminalQuote = false;
            _error = null;
          });
        },
        onRefresh: _refreshQuote,
        onConfirm: _confirm,
      );
    }

    final asyncCandidates = ref.watch(talkAiSeatCatalogProvider(widget.talkId));
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Text(widget.isHost ? 'Add AI' : 'Sponsor a Seat'),
        leading: IconButton(
          tooltip: 'Close',
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        bottom: TabBar(
          controller: _tabs,
          tabs: widget.onlyOwnedTwin
              ? const [Tab(text: 'My Twin')]
              : const [Tab(text: 'Experts'), Tab(text: 'Twins')],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
            child: TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Search by name or topic',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
          ),
          if (!widget.isHost)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 2, 14, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 17,
                    color: u.textMuted,
                  ),
                  const SizedBox(width: 7),
                  Expanded(
                    child: Text(
                      'You can sponsor an AI Seat. The Host still decides whether it joins the Talk.',
                      style: TextStyle(
                        color: u.textMuted,
                        fontSize: 12.5,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              child: Text(
                _error!,
                style: TextStyle(color: u.emergency, fontSize: 12.5),
              ),
            ),
          Expanded(
            child: asyncCandidates.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (_, __) => _SeatState(
                icon: Icons.wifi_off_rounded,
                title: 'Couldn’t load AI Seats.',
                subtitle: 'Pull down later or try again.',
                action: 'Try again',
                onAction: () =>
                    ref.invalidate(talkAiSeatCatalogProvider(widget.talkId)),
              ),
              data: (all) {
                final kind = widget.onlyOwnedTwin
                    ? TalkAiPersonaKind.twin
                    : _tabs.index == 0
                        ? TalkAiPersonaKind.expert
                        : TalkAiPersonaKind.twin;
                final query = _search.text.trim().toLowerCase();
                final items = all.where((candidate) {
                  if (candidate.kind != kind) return false;
                  if (widget.onlyOwnedTwin && !candidate.isOwnedByViewer) {
                    return false;
                  }
                  if (query.isEmpty) return true;
                  return candidate.displayName.toLowerCase().contains(query) ||
                      candidate.subtitle.toLowerCase().contains(query) ||
                      candidate.topics.any(
                        (topic) => topic.toLowerCase().contains(query),
                      );
                }).toList(growable: false);

                if (items.isEmpty) {
                  return _SeatState(
                    icon: kind == TalkAiPersonaKind.expert
                        ? Icons.verified_outlined
                        : Icons.auto_awesome_outlined,
                    title: query.isEmpty
                        ? kind == TalkAiPersonaKind.expert
                            ? 'No Experts available yet.'
                            : widget.onlyOwnedTwin
                                ? 'No verified owned Twin is available.'
                                : 'No Twins available yet.'
                        : 'No matches found.',
                    subtitle: query.isEmpty
                        ? kind == TalkAiPersonaKind.twin
                            ? 'Create a Twin, then return to this Talk to request a Seat.'
                            : 'Available AI personas will appear here.'
                        : 'Try a different name or topic.',
                    action: query.isNotEmpty
                        ? 'Clear search'
                        : kind == TalkAiPersonaKind.twin
                            ? 'Create My Twin'
                            : 'Refresh list',
                    onAction: () {
                      if (query.isNotEmpty) {
                        _search.clear();
                        setState(() {});
                      } else if (kind == TalkAiPersonaKind.twin) {
                        final router = GoRouter.of(context);
                        Navigator.of(context).pop();
                        router.push('/my-twin');
                      } else {
                        ref.invalidate(talkAiSeatCatalogProvider(widget.talkId));
                      }
                    },
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(
                      talkAiSeatCatalogProvider(widget.talkId),
                    );
                    await ref.read(
                      talkAiSeatCatalogProvider(widget.talkId).future,
                    );
                  },
                  child: ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(10, 4, 10, 24),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      return _CandidateTile(
                        candidate: items[index],
                        isHost: widget.isHost,
                        busy: _loadingQuote,
                        onTap: () => _select(items[index]),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CandidateTile extends StatelessWidget {
  const _CandidateTile({
    required this.candidate,
    required this.isHost,
    required this.busy,
    required this.onTap,
  });

  final TalkAiSeatCandidate candidate;
  final bool isHost;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final image = candidate.avatarUrl?.trim();
    return Material(
      color: u.surfaceCard,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: candidate.isAvailable && !busy ? onTap : null,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: u.structuralBorder),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 25,
                backgroundColor: u.surfaceMuted,
                backgroundImage:
                    image != null && image.isNotEmpty ? NetworkImage(image) : null,
                child: image == null || image.isEmpty
                    ? Icon(
                        candidate.kind == TalkAiPersonaKind.expert
                            ? Icons.verified_rounded
                            : Icons.auto_awesome_rounded,
                        color: u.brandStrong,
                      )
                    : null,
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      candidate.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: candidate.isAvailable
                            ? u.textPrimary
                            : u.textMuted,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (candidate.subtitle.trim().isNotEmpty)
                      Text(
                        candidate.subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: u.textMuted,
                          fontSize: 12.5,
                        ),
                      ),
                    if (candidate.topics.isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        candidate.topics.take(3).join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: u.textMuted,
                          fontSize: 11.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    candidate.seatFeeLabel.isEmpty
                        ? 'Price on quote'
                        : candidate.seatFeeLabel,
                    style: TextStyle(
                      color: u.textPrimary,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 5),
                  FilledButton(
                    onPressed:
                        candidate.isAvailable && !busy ? onTap : null,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(78, 34),
                      padding: const EdgeInsets.symmetric(horizontal: 11),
                    ),
                    child: Text(
                      candidate.isAvailable
                          ? isHost
                              ? 'Add'
                              : 'Sponsor'
                          : 'Unavailable',
                      style: const TextStyle(fontSize: 11.5),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuoteConfirmation extends StatelessWidget {
  const _QuoteConfirmation({
    required this.quote,
    required this.isHost,
    required this.confirming,
    required this.refreshing,
    required this.expired,
    required this.terminal,
    required this.error,
    required this.onBack,
    required this.onRefresh,
    required this.onConfirm,
  });

  final TalkAiSeatQuote quote;
  final bool isHost;
  final bool confirming;
  final bool refreshing;
  final bool expired;
  final bool terminal;
  final String? error;
  final VoidCallback onBack;
  final VoidCallback onRefresh;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        title: Text(isHost ? 'Confirm AI Seat' : 'Confirm sponsorship'),
        leading: IconButton(
          tooltip: 'Back',
          onPressed: confirming || refreshing ? null : onBack,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 24, 18, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: u.surfaceMuted,
                child: Icon(
                  quote.kind == TalkAiPersonaKind.expert
                      ? Icons.verified_rounded
                      : Icons.auto_awesome_rounded,
                  color: u.brandStrong,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                quote.displayName,
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 20),
              _QuoteRow(
                label: 'Seat fee',
                value: quote.totalLabel.isEmpty ? '—' : quote.totalLabel,
              ),
              const SizedBox(height: 10),
              _QuoteRow(
                label: 'Quote valid until',
                value: _formatQuoteExpiry(quote.expiresAt),
              ),
              const Divider(height: 26),
              Text(
                quote.requiresHostApproval
                    ? 'The payment is for the AI Seat request. The Host must still accept it before the AI joins.'
                    : 'This AI will use one available AI Seat if the Talk still has capacity.',
                style: TextStyle(
                  color: u.textMuted,
                  fontSize: 13.5,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'The final amount and expiry above come from a fresh server quote.',
                style: TextStyle(
                  color: u.textMuted,
                  fontSize: 12,
                ),
              ),
              if (expired) ...[
                const SizedBox(height: 12),
                Text(
                  'This price has expired. Get a new quote to continue.',
                  style: TextStyle(color: u.emergency),
                ),
              ],
              if (terminal && !expired) ...[
                const SizedBox(height: 12),
                Text(
                  'This Seat request ended. Request a new quote to continue.',
                  style: TextStyle(color: u.textMuted),
                ),
              ],
              if (error != null) ...[
                const SizedBox(height: 14),
                Text(
                  error!,
                  style: TextStyle(color: u.emergency),
                ),
              ],
              const Spacer(),
              if (expired || terminal) ...[
                FilledButton.tonal(
                  key: const ValueKey('ai-seat-refresh-quote'),
                  onPressed: confirming || refreshing ? null : onRefresh,
                  child: Text(refreshing ? 'Refreshing…' : 'Get new quote'),
                ),
                const SizedBox(height: 8),
              ],
              FilledButton(
                key: const ValueKey('ai-seat-confirm'),
                onPressed: confirming || refreshing || expired || terminal
                    ? null : onConfirm,
                child: confirming
                    ? const SizedBox(
                        width: 19,
                        height: 19,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        isHost ? 'Confirm and add' : 'Confirm sponsorship',
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuoteRow extends StatelessWidget {
  const _QuoteRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Row(
      children: [
        Text(label, style: TextStyle(color: u.textMuted)),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

String _formatQuoteExpiry(DateTime value) {
  final local = value.toLocal();
  String two(int number) => number.toString().padLeft(2, '0');
  return two(local.hour) + ':' + two(local.minute);
}

class _SeatState extends StatelessWidget {
  const _SeatState({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.action,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(28, 72, 28, 24),
      children: [
        Icon(icon, color: u.textMuted, size: 42),
        const SizedBox(height: 12),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted, fontSize: 13),
        ),
        if (action != null && onAction != null) ...[
          const SizedBox(height: 12),
          Center(
            child: TextButton(
              onPressed: onAction,
              child: Text(action!),
            ),
          ),
        ],
      ],
    );
  }
}
