import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../search/talk_search.dart';
import '../../state/talk_search_state.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';

class TalkSearchScreen extends ConsumerStatefulWidget {
  const TalkSearchScreen({
    super.key,
    this.initialQuery,
    this.onOpenTalk,
    this.onOpenPerson,
    this.onOpenPersona,
  });

  final String? initialQuery;
  final void Function(TalkDiscoveryItem talk)? onOpenTalk;
  final void Function(String handle)? onOpenPerson;
  final void Function(String publicId)? onOpenPersona;

  @override
  ConsumerState<TalkSearchScreen> createState() => _TalkSearchScreenState();
}

class _TalkSearchScreenState extends ConsumerState<TalkSearchScreen> {
  late final TextEditingController _query;
  final FocusNode _focus = FocusNode();
  Timer? _debounce;
  TalkSearchFilter _filter = TalkSearchFilter.all;
  TalkSearchResults _results = const TalkSearchResults();
  bool _loading = false;
  String? _error;
  int _requestSerial = 0;

  @override
  void initState() {
    super.initState();
    _query = TextEditingController(text: widget.initialQuery?.trim() ?? '');
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_query.text.trim().length >= 2) {
        _search();
      } else {
        _focus.requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    final trimmed = value.trim();
    if (trimmed.length < 2) {
      setState(() {
        _results = const TalkSearchResults();
        _error = null;
        _loading = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 320), _search);
  }

  Future<void> _search() async {
    final query = _query.text.trim();
    if (query.length < 2) return;
    final serial = ++_requestSerial;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await ref.read(talkSearchTransportProvider).search(
            query: query,
            filter: _filter,
          );
      if (!mounted || serial != _requestSerial) return;
      setState(() => _results = results);
    } catch (_) {
      if (!mounted || serial != _requestSerial) return;
      setState(() {
        _error = 'Couldn’t search right now.';
      });
    } finally {
      if (mounted && serial == _requestSerial) {
        setState(() => _loading = false);
      }
    }
  }

  void _selectFilter(TalkSearchFilter filter) {
    if (_filter == filter) return;
    setState(() {
      _filter = filter;
      _results = const TalkSearchResults();
      _error = null;
    });
    if (_query.text.trim().length >= 2) _search();
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final query = _query.text.trim();

    return Scaffold(
      key: const ValueKey('talk-search-screen'),
      backgroundColor: u.surfaceBg,
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          key: const ValueKey('talk-search-field'),
          controller: _query,
          focusNode: _focus,
          onChanged: _onQueryChanged,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _search(),
          style: const TextStyle(color: Colors.white),
          cursorColor: Colors.white,
          decoration: InputDecoration(
            hintText: 'Search Talks, people, Experts, Twins',
            hintStyle: TextStyle(color: Colors.white.withValues(alpha: .72)),
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
            isDense: true,
            suffixIcon: query.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear search',
                    onPressed: () {
                      _query.clear();
                      _onQueryChanged('');
                      _focus.requestFocus();
                    },
                    icon: const Icon(Icons.close_rounded, color: Colors.white),
                  ),
          ),
        ),
      ),
      body: Column(
        children: [
          _SearchFilters(
            selected: _filter,
            onSelected: _selectFilter,
          ),
          if (_loading)
            const LinearProgressIndicator(minHeight: 2)
          else
            const SizedBox(height: 2),
          Expanded(
            child: _SearchBody(
              query: query,
              results: _results,
              loading: _loading,
              error: _error,
              onRetry: _search,
              onOpenTalk: widget.onOpenTalk,
              onOpenPerson: widget.onOpenPerson,
              onOpenPersona: widget.onOpenPersona,
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchFilters extends StatelessWidget {
  const _SearchFilters({
    required this.selected,
    required this.onSelected,
  });

  final TalkSearchFilter selected;
  final ValueChanged<TalkSearchFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Container(
      width: double.infinity,
      color: u.surfaceCard,
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final filter in TalkSearchFilter.values) ...[
              ChoiceChip(
                key: ValueKey('search-filter-' + filter.name),
                label: Text(_filterLabel(filter)),
                selected: selected == filter,
                onSelected: (_) => onSelected(filter),
              ),
              if (filter != TalkSearchFilter.values.last)
                const SizedBox(width: 7),
            ],
          ],
        ),
      ),
    );
  }
}

class _SearchBody extends StatelessWidget {
  const _SearchBody({
    required this.query,
    required this.results,
    required this.loading,
    required this.error,
    required this.onRetry,
    this.onOpenTalk,
    this.onOpenPerson,
    this.onOpenPersona,
  });

  final String query;
  final TalkSearchResults results;
  final bool loading;
  final String? error;
  final VoidCallback onRetry;
  final void Function(TalkDiscoveryItem talk)? onOpenTalk;
  final void Function(String handle)? onOpenPerson;
  final void Function(String publicId)? onOpenPersona;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;

    if (query.length < 2) {
      return _SearchState(
        icon: Icons.search_rounded,
        title: 'Search Masanawa',
        subtitle: 'Find Talks, people, Experts and Twins.',
      );
    }

    if (error != null && results.isEmpty) {
      return _SearchState(
        icon: Icons.wifi_off_rounded,
        title: error!,
        subtitle: 'Check your connection and try again.',
        actionLabel: 'Try again',
        onAction: onRetry,
      );
    }

    if (!loading && results.isEmpty) {
      return _SearchState(
        icon: Icons.search_off_rounded,
        title: 'No results for “' + query + '”.',
        subtitle: 'Try another name, topic or keyword.',
      );
    }

    final rows = <Widget>[
      for (final talk in results.talks)
        _TalkResult(
          talk: talk,
          onTap: onOpenTalk == null ? null : () => onOpenTalk!(talk),
        ),
      for (final person in results.people)
        _PersonResult(
          person: person,
          onTap: onOpenPerson == null
              ? null
              : () => onOpenPerson!(person.handle),
        ),
      for (final persona in results.personas)
        _PersonaResult(
          persona: persona,
          onTap: onOpenPersona == null
              ? null
              : () => onOpenPersona!(persona.publicId),
        ),
    ];

    return ListView.separated(
      key: const ValueKey('talk-search-results'),
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 28),
      itemCount: rows.length,
      separatorBuilder: (_, __) => Divider(
        height: 1,
        indent: 68,
        color: u.structuralBorder,
      ),
      itemBuilder: (_, index) => rows[index],
    );
  }
}

class _TalkResult extends StatelessWidget {
  const _TalkResult({required this.talk, this.onTap});

  final TalkDiscoveryItem talk;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return _ResultTile(
      onTap: onTap,
      leading: CircleAvatar(
        radius: 22,
        backgroundColor: talk.isLive
            ? u.emergency.withValues(alpha: .12)
            : u.surfaceMuted,
        child: Icon(
          talk.isLive ? Icons.graphic_eq_rounded : Icons.play_arrow_rounded,
          color: talk.isLive ? u.emergency : u.brandStrong,
        ),
      ),
      title: talk.title,
      subtitle: talk.hostName.trim().isEmpty
          ? (talk.isLive ? 'Live Talk' : 'Replay')
          : (talk.isLive ? 'LIVE · ' : 'Replay · ') + talk.hostName,
      trailing: talk.listenerCount > 0
          ? Text(
              _compact(talk.listenerCount),
              style: TextStyle(color: u.textMuted, fontSize: 11.5),
            )
          : null,
    );
  }
}

class _PersonResult extends StatelessWidget {
  const _PersonResult({required this.person, this.onTap});

  final TalkSearchPerson person;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final avatar = person.avatarUrl?.trim();
    return _ResultTile(
      onTap: onTap,
      leading: CircleAvatar(
        radius: 22,
        backgroundColor: u.brandStrong,
        backgroundImage:
            avatar != null && avatar.isNotEmpty ? NetworkImage(avatar) : null,
        child: avatar == null || avatar.isEmpty
            ? const Icon(Icons.person_rounded, color: Colors.white)
            : null,
      ),
      title: person.displayName,
      subtitle: '@' +
          person.handle +
          (person.bio.trim().isEmpty ? '' : ' · ' + person.bio.trim()),
      trailing: person.isLive
          ? Text(
              'LIVE',
              style: TextStyle(
                color: u.emergency,
                fontSize: 10.5,
                fontWeight: FontWeight.w800,
              ),
            )
          : null,
    );
  }
}

class _PersonaResult extends StatelessWidget {
  const _PersonaResult({required this.persona, this.onTap});

  final TalkSearchPersona persona;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final avatar = persona.avatarUrl?.trim();
    final expert = persona.kind == TalkSearchPersonaKind.expert;
    return _ResultTile(
      onTap: onTap,
      leading: CircleAvatar(
        radius: 22,
        backgroundColor: u.surfaceMuted,
        backgroundImage:
            avatar != null && avatar.isNotEmpty ? NetworkImage(avatar) : null,
        child: avatar == null || avatar.isEmpty
            ? Icon(
                expert ? Icons.verified_rounded : Icons.auto_awesome_rounded,
                color: u.brandStrong,
              )
            : null,
      ),
      title: persona.displayName,
      subtitle: (expert ? 'Masanawa Expert' : 'User Twin') +
          (persona.role.trim().isEmpty ? '' : ' · ' + persona.role.trim()),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            persona.isAvailable ? 'Available' : 'Unavailable',
            style: TextStyle(
              color: persona.isAvailable ? u.brandStrong : u.textMuted,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (persona.seatFeeLabel.trim().isNotEmpty)
            Text(
              persona.seatFeeLabel,
              style: TextStyle(color: u.textMuted, fontSize: 11),
            ),
        ],
      ),
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({
    required this.leading,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
  });

  final Widget leading;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Material(
      color: u.surfaceCard,
      child: ListTile(
        onTap: onTap,
        contentPadding: const EdgeInsets.fromLTRB(12, 8, 10, 8),
        leading: leading,
        title: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 14.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        subtitle: Text(
          subtitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: u.textMuted, fontSize: 12.5),
        ),
        trailing: trailing ??
            (onTap == null
                ? null
                : Icon(Icons.chevron_right_rounded, color: u.textMuted)),
      ),
    );
  }
}

class _SearchState extends StatelessWidget {
  const _SearchState({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(28, 88, 28, 28),
      children: [
        Icon(icon, size: 42, color: u.textMuted),
        const SizedBox(height: 12),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: u.textPrimary,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(color: u.textMuted, fontSize: 13),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 12),
          Center(
            child: TextButton(
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
          ),
        ],
      ],
    );
  }
}

String _filterLabel(TalkSearchFilter filter) => switch (filter) {
      TalkSearchFilter.all => 'All',
      TalkSearchFilter.talks => 'Talks',
      TalkSearchFilter.people => 'People',
      TalkSearchFilter.experts => 'Experts',
      TalkSearchFilter.twins => 'Twins',
    };

String _compact(int value) {
  if (value >= 1000000) {
    final n = value / 1000000;
    return n.toStringAsFixed(n >= 10 ? 0 : 1) + 'M';
  }
  if (value >= 1000) {
    final n = value / 1000;
    return n.toStringAsFixed(n >= 10 ? 0 : 1) + 'K';
  }
  return value.toString();
}
