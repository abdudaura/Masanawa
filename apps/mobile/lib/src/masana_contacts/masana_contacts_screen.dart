import 'package:flutter/material.dart';

import '../agents/twin_directory.dart';
import 'masana_directory_controller.dart';

enum MasanaContactsTab { masana, contacts }

/// Nested Chats > New chat destination. C01/C02 supply human Contacts content
/// and keep exclusive authority over people, admission and private messages.
class MasanaContactsScreen extends StatefulWidget {
  const MasanaContactsScreen({
    super.key,
    required this.transport,
    required this.accountId,
    required this.isCurrentAccount,
    required this.contactsBuilder,
    required this.onOpenMasana,
    this.initialTab = MasanaContactsTab.masana,
  });

  final TwinDirectoryTransport transport;
  final String accountId;
  final bool Function(String accountId) isCurrentAccount;

  /// Human Contacts BODY (without a second Scaffold/AppBar), not AI records.
  final WidgetBuilder contactsBuilder;
  final void Function(TwinDirectoryEntry verifiedMasana) onOpenMasana;
  final MasanaContactsTab initialTab;

  @override
  State<MasanaContactsScreen> createState() => _MasanaContactsScreenState();
}

class _MasanaContactsScreenState extends State<MasanaContactsScreen> {
  late MasanaDirectoryController _directory;
  final _search = TextEditingController();
  late MasanaContactsTab _tab;

  MasanaDirectoryController _makeController() => MasanaDirectoryController(
        transport: widget.transport,
        accountId: widget.accountId,
        isCurrentAccount: (id) => widget.isCurrentAccount(id),
      );

  @override
  void initState() {
    super.initState();
    _tab = widget.initialTab;
    _directory = _makeController();
    if (_tab == MasanaContactsTab.masana) _directory.loadInitial();
  }

  @override
  void didUpdateWidget(covariant MasanaContactsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.transport != widget.transport) {
      _directory.dispose();
      _directory = _makeController();
      _search.clear();
      _tab = widget.initialTab;
      if (_tab == MasanaContactsTab.masana) _directory.loadInitial();
    }
  }

  @override
  void dispose() {
    _directory.dispose();
    _search.dispose();
    super.dispose();
  }

  void _switchTo(MasanaContactsTab tab) {
    if (_tab == tab) return;
    if (tab == MasanaContactsTab.contacts) {
      _directory.invalidate();
      _search.clear();
    } else {
      _directory.loadInitial();
    }
    setState(() => _tab = tab);
  }

  @override
  Widget build(BuildContext context) {
    final authorized = widget.accountId.trim().isNotEmpty &&
        widget.isCurrentAccount(widget.accountId);
    return Scaffold(
      appBar: AppBar(title: const Text('Masana & Contacts')),
      body: !authorized
          ? const Center(child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Sign in to view your directory.'),
            ))
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                  child: SizedBox(
                    width: double.infinity,
                    child: SegmentedButton<MasanaContactsTab>(
                      showSelectedIcon: false,
                      segments: const [
                        ButtonSegment(
                          value: MasanaContactsTab.masana,
                          icon: Icon(Icons.smart_toy_outlined),
                          label: Text('Masana'),
                        ),
                        ButtonSegment(
                          value: MasanaContactsTab.contacts,
                          icon: Icon(Icons.people_outline),
                          label: Text('Contacts'),
                        ),
                      ],
                      selected: {_tab},
                      onSelectionChanged: (selection) =>
                          _switchTo(selection.first),
                    ),
                  ),
                ),
                Expanded(
                  child: _tab == MasanaContactsTab.contacts
                      ? KeyedSubtree(
                          key: ValueKey('human-contacts-' + widget.accountId),
                          child: widget.contactsBuilder(context),
                        )
                      : _masanaContent(),
                ),
              ],
            ),
    );
  }

  Widget _masanaContent() => AnimatedBuilder(
        animation: _directory,
        builder: (context, _) {
          final state = _directory;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: TextField(
                  key: const Key('masanaDirectorySearch'),
                  controller: _search,
                  maxLength: 80,
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Search public Masana',
                    counterText: '',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _search.text.isEmpty ? null : IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        _search.clear();
                        state.setQuery('');
                        setState(() {});
                      },
                    ),
                    border: const OutlineInputBorder(),
                  ),
                  onChanged: (value) {
                    state.setQuery(value);
                    setState(() {});
                  },
                ),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: state.loadInitial,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      if (state.error != null)
                        SliverToBoxAdapter(
                          child: Semantics(
                            liveRegion: true,
                            child: ListTile(
                              leading: const Icon(Icons.info_outline),
                              title: Text(state.error!),
                              trailing: TextButton(
                                onPressed: state.loadingMore
                                    ? null
                                    : state.nextCursor == null
                                        ? state.loadInitial
                                        : state.loadMore,
                                child: const Text('Retry'),
                              ),
                            ),
                          ),
                        ),
                      if (state.loading)
                        const SliverFillRemaining(
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (state.items.isEmpty)
                        SliverFillRemaining(
                          child: Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text(
                                state.error != null
                                    ? 'No verified Masana available offline.'
                                    : state.query.isEmpty
                                        ? 'No public Masana yet. Pull to refresh.'
                                        : 'No Masana match this search.',
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                        )
                      else ...[
                        SliverList.builder(
                          itemCount: state.items.length,
                          itemBuilder: (context, index) {
                            final entry = state.items[index];
                            final opening = state.openingPublicId == entry.publicId;
                            return ListTile(
                              key: ValueKey('masana-' + entry.publicId),
                              leading: CircleAvatar(child: Text(entry.initials)),
                              title: Text(entry.displayName,
                                  maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('AI persona'),
                                  if (entry.bio.trim().isNotEmpty)
                                    Text(entry.bio,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis),
                                ],
                              ),
                              trailing: opening
                                  ? const SizedBox(width: 22, height: 22,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2))
                                  : Icon(entry.voiceEnabled
                                      ? Icons.record_voice_over_outlined
                                      : Icons.chevron_right),
                              enabled: state.canInteract &&
                                  state.openingPublicId == null,
                              onTap: () => state.open(entry, widget.onOpenMasana),
                            );
                          },
                        ),
                        if (state.nextCursor != null)
                          SliverToBoxAdapter(
                            child: TextButton(
                              onPressed: state.loadingMore ? null : state.loadMore,
                              child: Text(state.loadingMore
                                  ? 'Loading…' : 'Load more'),
                            ),
                          ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      );
