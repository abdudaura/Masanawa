import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../human_messages/human_dm_transport.dart';
import '../messages/human_contacts_controller.dart';
import '../messages/human_contacts_transport.dart';
import '../state/session_state.dart';
import 'contact_hub_favorites.dart';

/// A nested Chats destination, not a bottom tab and never an AI character list.
/// The F12 shell owner mounts this at /messages/contacts and supplies the
/// canonical C02 route callback. C01 and C02 remain the sole API authorities.
class HumanContactHubScreen extends ConsumerStatefulWidget {
  const HumanContactHubScreen({
    super.key,
    required this.dmTransport,
    required this.onOpenConversation,
    this.onOpenPersonProfile,
    this.favoritesStore,
  });

  final HumanDmTransport dmTransport;
  final void Function(String conversationId, String otherDisplayName)
      onOpenConversation;
  final void Function(String humanUserId)? onOpenPersonProfile;
  final ContactHubFavoritesStore? favoritesStore;

  @override
  ConsumerState<HumanContactHubScreen> createState() =>
      _HumanContactHubScreenState();
}

class _HumanContactHubScreenState extends ConsumerState<HumanContactHubScreen> {
  final _filter = TextEditingController();
  final _handle = TextEditingController();
  late final ContactHubFavoritesStore _favorites;

  String? _favoritesOwner;
  String? _observedOwner;
  Set<String> _favoriteIds = {};
  bool _findVisible = false;
  String? _openingId;
  String? _openingOwner;
  String? _localError;
  bool _savingFavorite = false;
  int _loadEpoch = 0;

  @override
  void initState() {
    super.initState();
    _favorites = widget.favoritesStore ?? const SecureContactHubFavoritesStore();
    _filter.addListener(_onFilterChanged);
  }

  void _onFilterChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    ++_loadEpoch;
    _filter.removeListener(_onFilterChanged);
    _filter.dispose();
    _handle.dispose();
    super.dispose();
  }

  String? _signedInId() {
    final session = ref.read(sessionProvider);
    return session is SessionSignedIn ? session.user.id : null;
  }

  void _loadFavorites(String userId) {
    final epoch = ++_loadEpoch;
    // No favorites from the previous account are displayed while loading.
    _favoritesOwner = null;
    _favoriteIds = {};
    unawaited(() async {
      try {
        final ids = await _favorites.load(userId);
        if (!mounted || epoch != _loadEpoch || _signedInId() != userId) return;
        setState(() {
          _favoritesOwner = userId;
          _favoriteIds = ids;
        });
      } catch (_) {
        if (!mounted || epoch != _loadEpoch || _signedInId() != userId) return;
        setState(() {
          _favoritesOwner = userId;
          _favoriteIds = {};
          _localError = 'Saved favorites are unavailable on this device.';
        });
      }
    }());
  }

  Future<void> _toggleFavorite(HumanContact contact, String userId) async {
    if (_signedInId() != userId || _favoritesOwner != userId ||
        _savingFavorite) return;
    final before = Set<String>.of(_favoriteIds);
    final next = Set<String>.of(before);
    if (!next.add(contact.userId)) next.remove(contact.userId);
    if (next.length > 500) {
      setState(() => _localError = 'You can save up to 500 favorites.');
      return;
    }
    setState(() {
      _favoriteIds = next;
      _savingFavorite = true;
      _localError = null;
    });
    try {
      await _favorites.save(userId, next);
      if (!mounted || _signedInId() != userId) return;
    } catch (_) {
      if (!mounted || _signedInId() != userId) return;
      setState(() {
        _favoriteIds = before;
        _localError = 'Could not save favorites. Please retry.';
      });
    } finally {
      if (mounted && _signedInId() == userId) {
        setState(() => _savingFavorite = false);
      }
    }
  }

  Future<void> _open(HumanContact person, String userId) async {
    // Server supplied C01 state is a presentation hint only. C02 reauthorizes
    // at conversation open and each send; never open for a device phone number.
    if (!(person.status == HumanContactStatus.accepted ||
            person.canMessage) ||
        _openingId != null ||
        _signedInId() != userId) {
      return;
    }
    setState(() {
      _openingId = person.userId;
      _openingOwner = userId;
      _localError = null;
    });
    try {
      final conversationId = await widget.dmTransport.open(person.userId);
      if (!mounted || _signedInId() != userId || _openingOwner != userId) {
        return;
      }
      if (conversationId.isEmpty) throw const FormatException('Empty conversation');
      widget.onOpenConversation(conversationId, person.displayName);
    } catch (_) {
      if (mounted && _signedInId() == userId) {
        setState(() {
          _localError =
              'Could not open this conversation. Check your connection or contact permission and retry.';
        });
      }
    } finally {
      if (mounted && _openingOwner == userId) {
        setState(() {
          _openingId = null;
          _openingOwner = null;
        });
      }
    }
  }

  Future<void> _find() async {
    final value = _handle.text.trim();
    if (value.isEmpty) return;
    await ref.read(humanContactsProvider.notifier).findByHandle(value);
  }

  Future<void> _confirmRemove(
      HumanContact contact, HumanContactsController actions) async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove contact?'),
        content: const Text(
          'The connection will be removed. Existing messages are not deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (accepted == true && mounted) await actions.revoke(contact.userId);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    if (session is! SessionSignedIn) {
      // Unmount all PII: a later authentication must fetch its own C01 state.
      _loadEpoch++;
      _favoritesOwner = null;
      _observedOwner = null;
      _favoriteIds = {};
      _openingId = null;
      _openingOwner = null;
      _localError = null;
      _savingFavorite = false;
      return Scaffold(
        appBar: AppBar(title: const Text('Contacts')),
        body: const Center(child: Text('Sign in to see your Masanawa contacts.')),
      );
    }
    final userId = session.user.id;
    if (_observedOwner != userId) {
      _observedOwner = userId;
      _favoritesOwner = null;
      _favoriteIds = {};
      _openingId = null;
      _openingOwner = null;
      _savingFavorite = false;
      _localError = null;
      final pendingOwner = userId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _signedInId() == pendingOwner) {
          // Clear private exact-handle and local-filter input without
          // notifying listeners during build.
          _filter.clear();
          _handle.clear();
          _findVisible = false;
          _loadFavorites(pendingOwner);
        }
      });
      // Never render previous-account search text for even one transition
      // frame. The ordinary contacts body renders after the account fence.
      return Scaffold(
        appBar: AppBar(title: const Text('Contacts')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    final contactsState = ref.watch(humanContactsProvider);
    final actions = ref.read(humanContactsProvider.notifier);
    final filter = _filter.text.trim().toLowerCase();
    final known = contactsState.contacts.where((c) =>
        c.displayName.toLowerCase().contains(filter) ||
        c.handle.toLowerCase().contains(filter)).toList(growable: false)
      ..sort((a, b) {
        final sort = a.displayName.toLowerCase().compareTo(
            b.displayName.toLowerCase());
        return sort != 0 ? sort : a.userId.compareTo(b.userId);
      });
    final accepted = known.where(
        (c) => c.status == HumanContactStatus.accepted).toList(growable: false);
    final favorites = accepted.where(
        (c) => _favoritesOwner == userId && _favoriteIds.contains(c.userId))
        .toList(growable: false);
    final incoming = known.where(
        (c) => c.status == HumanContactStatus.incoming).toList(growable: false);
    final outgoing = known.where(
        (c) => c.status == HumanContactStatus.outgoing).toList(growable: false);
    final others = known.where((c) =>
        c.status == HumanContactStatus.revoked ||
        c.status == HumanContactStatus.declined).toList(growable: false);
    final enabled = !contactsState.busy && _openingId == null;
    final hasMore = contactsState.nextCursor != null;
    // Legacy transports cannot prove completion once the 50-row cap is hit.
    // A cursor-aware C01 response with null nextCursor is authoritative.
    final legacyMayBeTruncated = contactsState.contacts.length >= 50 &&
        ref.read(humanContactsTransportProvider) is! HumanContactsPaginationTransport;
    final canFavorite = enabled && !_savingFavorite;

    // Keep entry metadata lightweight. Flutter builds only visible rows in
    // SliverList.builder; never allocate a widget for every server contact.
    // C01 currently returns at most 100 contacts and does not expose a cursor.
    final entries = <_HubEntry>[];
    void section(String heading, List<HumanContact> people,
        {bool showStars = false}) {
      if (people.isEmpty) return;
      entries.add(_HubEntry(heading: heading));
      for (final person in people) {
        entries.add(_HubEntry(
          heading: heading,
          person: person,
          showStar: showStars,
        ));
      }
    }

    section('Favorites', favorites, showStars: true);
    section('Masanawa contacts', accepted, showStars: true);
    section('Incoming requests', incoming);
    section('Sent requests', outgoing);
    section('Previous requests', others);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Contacts'),
        actions: [
          IconButton(
            tooltip: 'Refresh contacts',
            onPressed: enabled && !contactsState.loading
                ? actions.refresh
                : null,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: actions.refresh,
        child: CustomScrollView(
          key: const PageStorageKey('human_contact_hub_scroll'),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      key: const Key('hubFilter'),
                      controller: _filter,
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search),
                        hintText: 'Search your Masanawa contacts',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      icon: const Icon(Icons.alternate_email),
                      label: const Text('Add by exact @handle'),
                      onPressed: () => setState(
                          () => _findVisible = !_findVisible),
                    ),
                    if (_findVisible) ...[
                      const SizedBox(height: 8),
                      TextField(
                        key: const Key('hubHandle'),
                        controller: _handle,
                        autocorrect: false,
                        textCapitalization: TextCapitalization.none,
                        textInputAction: TextInputAction.search,
                        decoration: const InputDecoration(
                          labelText: 'Person’s exact @handle',
                          border: OutlineInputBorder(),
                        ),
                        onSubmitted: (_) => _find(),
                      ),
                      const SizedBox(height: 6),
                      FilledButton(
                        onPressed: enabled && !contactsState.searching
                            ? _find
                            : null,
                        child: const Text('Find person'),
                      ),
                    ],
                    if (contactsState.loading || contactsState.searching ||
                        contactsState.busy)
                      const LinearProgressIndicator(),
                    if (contactsState.error != null)
                      _HubNotice(contactsState.error!, retry: actions.refresh),
                    if (_localError != null) _HubNotice(_localError!),
                    if (contactsState.notice != null)
                      _HubNotice(contactsState.notice!),
                    if (contactsState.lookup != null) ...[
                      const SizedBox(height: 12),
                      Text('Handle result',
                          style: Theme.of(context).textTheme.titleMedium),
                      _PersonRow(
                        person: contactsState.lookup!,
                        enabled: enabled,
                        isOpening:
                            _openingId == contactsState.lookup!.userId,
                        favorite: false,
                        showStar: false,
                        onToggleFavorite: null,
                        onMessage: () =>
                            _open(contactsState.lookup!, userId),
                        onRequest: () =>
                            actions.request(contactsState.lookup!.handle),
                        onRespond: (accept) => actions.respond(
                            contactsState.lookup!.userId,
                            accept: accept,
                            requestRevision:
                                contactsState.lookup!.requestRevision!),
                        onRevoke: () =>
                            _confirmRemove(contactsState.lookup!, actions),
                      ),
                    ],
                    if (!contactsState.loading && entries.isEmpty)
                      Padding(
                        padding: const EdgeInsets.all(20),
                        child: Text(
                          hasMore
                              ? 'No match among loaded contacts yet. Load more contacts or search by exact @handle.'
                              : 'No matching contacts yet. Add someone by their exact @handle. No phonebook access is required.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    if (legacyMayBeTruncated)
                      const Padding(
                        padding: EdgeInsets.only(top: 10),
                        child: Text(
                          'Some contacts may not appear yet. More results require contact-service pagination.',
                        ),
                      ),
                  ],
                ),
              ),
            ),
            SliverList.builder(
              itemCount: entries.length,
              itemBuilder: (context, index) {
                final entry = entries[index];
                final person = entry.person;
                if (person == null) {
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
                    child: Text(entry.heading,
                        style: Theme.of(context).textTheme.titleMedium),
                  );
                }
                return _PersonRow(
                  key: ValueKey('${entry.heading}_${person.userId}'),
                  person: person,
                  enabled: canFavorite,
                  isOpening: _openingId == person.userId,
                  favorite: _favoritesOwner == userId &&
                      _favoriteIds.contains(person.userId),
                  showStar: entry.showStar,
                  onToggleFavorite: () => _toggleFavorite(person, userId),
                  onMessage: () => _open(person, userId),
                  onRequest: () => actions.request(person.handle),
                  onRespond: (accept) => actions.respond(person.userId,
                      accept: accept, requestRevision: person.requestRevision!),
                  onRevoke: () => _confirmRemove(person, actions),
                  onProfile: widget.onOpenPersonProfile == null
                      ? null
                      : () => widget.onOpenPersonProfile!(person.userId),
                );
              },
            ),
            if (hasMore)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Column(
                    children: [
                      if (contactsState.loadingMore)
                        const LinearProgressIndicator(),
                      OutlinedButton.icon(
                        key: const Key('hubLoadMore'),
                        onPressed: enabled && !contactsState.loading &&
                                !contactsState.loadingMore
                            ? actions.loadMore
                            : null,
                        icon: const Icon(Icons.expand_more),
                        label: const Text('Load more contacts'),
                      ),
                    ],
                  ),
                ),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }
}

class _HubEntry {
  const _HubEntry({required this.heading, this.person, this.showStar = false});
  final String heading;
  final HumanContact? person;
  final bool showStar;
}

class _HubNotice extends StatelessWidget {
  const _HubNotice(this.message, {this.retry});
  final String message;
  final VoidCallback? retry;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: ListTile(
      leading: const Icon(Icons.info_outline),
      title: Text(message),
      trailing: retry == null
          ? null
          : TextButton(onPressed: retry, child: const Text('Retry')),
    ),
  );
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({
    super.key,
    required this.person,
    required this.enabled,
    required this.favorite,
    required this.showStar,
    required this.isOpening,
    required this.onToggleFavorite,
    required this.onMessage,
    required this.onRequest,
    required this.onRespond,
    required this.onRevoke,
    this.onProfile,
  });
  final HumanContact person;
  final bool enabled, favorite, showStar, isOpening;
  final VoidCallback? onToggleFavorite;
  final VoidCallback onMessage, onRequest, onRevoke;
  final void Function(bool accept) onRespond;
  final VoidCallback? onProfile;

  @override
  Widget build(BuildContext context) {
    final status = person.status;
    final canOpen = status == HumanContactStatus.accepted ||
        (status == HumanContactStatus.none && person.canMessage);
    final initial = person.displayName.trim().isEmpty
        ? '?'
        : person.displayName.trim().substring(0, 1).toUpperCase();
    final url = person.avatarUrl;
    final avatar = url != null && Uri.tryParse(url)?.scheme == 'https'
        ? NetworkImage(url)
        : null;
    final statusText = switch (status) {
      HumanContactStatus.accepted => 'Contact',
      HumanContactStatus.incoming => 'Requested to connect',
      HumanContactStatus.outgoing => 'Waiting for approval',
      HumanContactStatus.revoked => 'Connection removed',
      HumanContactStatus.declined => 'Request declined',
      HumanContactStatus.none => person.canMessage
          ? 'Can receive a message' : 'Not connected',
    };
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Column(
          children: [
            ListTile(
              leading: CircleAvatar(
                foregroundImage: avatar,
                child: Text(initial),
              ),
              title: Text(person.displayName, maxLines: 1,
                  overflow: TextOverflow.ellipsis),
              subtitle: Text('@${person.handle} · $statusText',
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              onTap: onProfile,
              trailing: showStar
                  ? IconButton(
                      tooltip: favorite ? 'Remove from favorites' :
                          'Add to favorites',
                      onPressed: enabled ? onToggleFavorite : null,
                      icon: Icon(favorite ? Icons.star : Icons.star_border),
                    )
                  : null,
            ),
            if (isOpening) const LinearProgressIndicator(),
            Padding(
              padding: const EdgeInsets.only(right: 12, bottom: 4),
              child: Align(
                alignment: Alignment.centerRight,
                child: Wrap(
                  spacing: 6,
                  children: [
                    if (canOpen)
                      FilledButton(
                        onPressed: enabled ? onMessage : null,
                        child: const Text('Message'),
                      ),
                    if (status == HumanContactStatus.incoming) ...[
                      OutlinedButton(
                        onPressed: enabled && person.requestRevision != null
                            ? () => onRespond(false) : null,
                        child: const Text('Decline'),
                      ),
                      FilledButton(
                        onPressed: enabled && person.requestRevision != null
                            ? () => onRespond(true) : null,
                        child: const Text('Accept'),
                      ),
                    ],
                    if (status == HumanContactStatus.outgoing ||
                        status == HumanContactStatus.accepted)
                      TextButton(
                        onPressed: enabled ? onRevoke : null,
                        child: Text(status == HumanContactStatus.outgoing
                            ? 'Withdraw' : 'Remove'),
                      ),
                    if (status == HumanContactStatus.none &&
                        !person.canMessage ||
                        status == HumanContactStatus.revoked)
                      OutlinedButton(
                        onPressed: enabled ? onRequest : null,
                        child: const Text('Request'),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
