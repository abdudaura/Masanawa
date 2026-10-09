import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/providers.dart';
import '../state/session_state.dart';
import 'human_dm_controller.dart';


String? normalizeHumanRecipientHandle(String raw) {
  final handle = raw.trim().replaceFirst(RegExp(r'^@'), '').toLowerCase();
  return RegExp(r'^[a-z0-9_][a-z0-9_.-]{1,39}$').hasMatch(handle) ? handle : null;
}

bool validHumanConversationId(String id) =>
  RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$').hasMatch(id);

class HumanNewMessageScreen extends ConsumerStatefulWidget {
  const HumanNewMessageScreen({super.key, this.initialHandle});

  final String? initialHandle;

  @override
  ConsumerState<HumanNewMessageScreen> createState() =>
      _HumanNewMessageScreenState();
}

class _ContactCandidate {
  const _ContactCandidate({
    required this.userId,
    required this.handle,
    required this.displayName,
    required this.canMessage,
    required this.status,
    this.requestRevision,
  });

  final String userId;
  final String handle;
  final String displayName;
  final bool canMessage;
  final String status;
  final String? requestRevision;

  factory _ContactCandidate.parse(dynamic raw, {bool fromLookup = false}) {
    if (raw is! Map) throw const FormatException('Invalid contact response');
    final data = Map<String, dynamic>.from(raw);
    final userId = data['userId'];
    final handle = data['handle'];
    final displayName = data['displayName'];
    final status = data['status'];
    if (userId is! String || userId.length < 3 || userId.length > 256 ||
        handle is! String || handle.isEmpty ||
        displayName is! String || displayName.isEmpty ||
        status is! String ||
        !const {'none', 'incoming', 'outgoing', 'accepted', 'declined', 'revoked'}
            .contains(status)) {
      throw const FormatException('Invalid contact response');
    }
    final revision = data['requestRevision'];
    if (revision != null &&
        (revision is! String ||
         !RegExp(r'^[1-9][0-9]{0,18}$').hasMatch(revision))) {
      throw const FormatException('Invalid contact revision');
    }
    // Only a
    // fresh C01 identity lookup can supply eligibility; opening remains C02
    // server-authorized and cannot be inferred from the UI flag.
    if (fromLookup && data['canMessage'] is! bool) {
      throw const FormatException('Missing contact eligibility');
    }
    return _ContactCandidate(
      userId: userId,
      handle: handle,
      displayName: displayName,
      canMessage: fromLookup && data['canMessage'] == true,
      status: status,
      requestRevision: revision as String?,
    );
  }
}

class _HumanNewMessageScreenState
    extends ConsumerState<HumanNewMessageScreen> {
  final _handle = TextEditingController();
  List<_ContactCandidate> _contacts = const [];
  _ContactCandidate? _result;
  String? _error;
  String? _notice;
  bool _loading = false;
  bool _searching = false;
  bool _acting = false;
  String? _owner;
  int _generation = 0;
  int _lookupEpoch = 0;

  @override
  void initState() {
    super.initState();
    _handle.text = widget.initialHandle ?? '';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadContacts();
      if (mounted && _handle.text.trim().isNotEmpty) _search();
    });
  }

  @override
  void dispose() {
    ++_generation;
    _handle.dispose();
    super.dispose();
  }

  String? _signedInOwner() {
    final current = ref.read(sessionProvider);
    return current is SessionSignedIn ? current.user.id : null;
  }

  bool _current(String? owner, int epoch) =>
      mounted && owner != null &&
      _owner == owner && epoch == _generation &&
      _signedInOwner() == owner;

  String _errorMessage(Object error) {
    if (error is DioException) {
      return switch (error.response?.statusCode) {
        401 => 'Your session expired. Sign in again.',
        403 => 'Messaging is not permitted for this account.',
        404 => 'This person is not available for new contacts.',
        409 => 'Contact permission changed. Refresh and try again.',
        429 => 'Too many requests. Try again later.',
        _ => 'Could not contact Masanawa. Check your connection and retry.',
      };
    }
    if (error is FormatException) {
      return 'The contact service returned an invalid response. Please retry.';
    }
    return 'Could not complete the request. Please retry.';
  }

  Future<void> _loadContacts() async {
    final owner = _signedInOwner();
    final epoch = _generation;
    if (owner == null || _loading || !_current(owner, epoch)) return;
    setState(() { _loading = true; _error = null; });
    try {
      final response = await ref.read(apiClientProvider).dio.get<dynamic>(
        '/messages/contacts', queryParameters: {'limit': 50},
      );
      final data = response.data;
      if (data is! Map || data['contacts'] is! List) {
        throw const FormatException('Invalid contact list');
      }
      final people = (data['contacts'] as List)
          .map((raw) => _ContactCandidate.parse(raw)).toList(growable: false);
      if (!_current(owner, epoch)) return;
      setState(() => _contacts = people);
    } catch (error) {
      if (_current(owner, epoch)) setState(() => _error = _errorMessage(error));
    } finally {
      if (_current(owner, epoch)) setState(() => _loading = false);
    }
  }

  String? _normalizedHandle() {
    return normalizeHumanRecipientHandle(_handle.text);
  }

  Future<void> _search() async {
    final owner = _signedInOwner();
    final handle = _normalizedHandle();
    if (owner == null || _searching || _acting) return;
    if (handle == null) {
      setState(() => _error = 'Enter a valid exact @handle.');
      return;
    }
    final epoch = _generation;
    final lookupEpoch = ++_lookupEpoch;
    setState(() {
      _searching = true;
      _result = null;
      _notice = null;
      _error = null;
    });
    try {
      final response = await ref.read(apiClientProvider).dio.get<dynamic>(
        '/messages/contacts/lookup/' + Uri.encodeComponent(handle),
      );
      final found = _ContactCandidate.parse(response.data, fromLookup: true);
      if (!_current(owner, epoch) || lookupEpoch != _lookupEpoch) return;
      setState(() => _result = found);
    } catch (error) {
      if (!_current(owner, epoch) || lookupEpoch != _lookupEpoch) return;
      setState(() => _error = _errorMessage(error));
    } finally {
      if (_current(owner, epoch) && lookupEpoch == _lookupEpoch) setState(() => _searching = false);
    }
  }

  Future<void> _requestContact(_ContactCandidate person) async {
    final owner = _signedInOwner();
    final epoch = _generation;
    if (!_current(owner, epoch) || _acting) return;
    setState(() { _acting = true; _error = null; _notice = null; });
    try {
      final response = await ref.read(apiClientProvider).dio.post<dynamic>(
        '/messages/contacts/requests',
        data: {'handle': person.handle},
      );
      final raw = response.data;
      final result = raw is Map ? raw['status'] : null;
      if (!const {'accepted', 'pending', 'existing'}.contains(result)) {
        throw const FormatException('Invalid contact request status');
      }
      if (!_current(owner, epoch)) return;
      setState(() => _notice = result == 'accepted'
          ? 'Contact accepted. Search again to confirm you can message.'
          : 'Contact request recorded. Messaging depends on consent.');
    } catch (error) {
      if (_current(owner, epoch)) setState(() => _error = _errorMessage(error));
    } finally {
      if (_current(owner, epoch)) setState(() => _acting = false);
    }
  }

  Future<void> _respond(_ContactCandidate person, bool accept) async {
    final owner = _signedInOwner();
    final epoch = _generation;
    final revision = person.requestRevision;
    if (!_current(owner, epoch) || _acting || revision == null ||
        person.status != 'incoming') return;
    setState(() { _acting = true; _error = null; _notice = null; });
    try {
      final response = await ref.read(apiClientProvider).dio.post<dynamic>(
        '/messages/contacts/requests/' +
            Uri.encodeComponent(person.userId) + '/response',
        data: {'accept': accept, 'requestRevision': revision},
      );
      final payload = response.data;
      final result = payload is Map ? payload['status'] : null;
      if (result != (accept ? 'accepted' : 'declined')) {
        throw const FormatException('Invalid contact response status');
      }
      if (!_current(owner, epoch)) return;
      setState(() {
        _result = null;
        _notice = accept
          ? 'Request accepted. Search again to confirm messaging eligibility.'
          : 'Contact request declined.';
      });
      await _loadContacts();
    } catch (error) {
      if (_current(owner, epoch)) setState(() => _error = _errorMessage(error));
    } finally {
      if (_current(owner, epoch)) setState(() => _acting = false);
    }
  }

  Future<void> _open(_ContactCandidate person) async {
    final owner = _signedInOwner();
    final epoch = _generation;
    if (!_current(owner, epoch) || _acting) return;
    setState(() { _acting = true; _error = null; _notice = null; });
    try {
      // This is the ONLY authority that may create a DM. A list/search result
      // does not confer permission, and failure creates no local fake thread.
      final id = await ref.read(humanDmTransportProvider).open(person.userId);
      if (!_current(owner, epoch)) return;
      if (!validHumanConversationId(id)) {
        throw const FormatException('Invalid conversation identity');
      }
      if (!mounted) return;
      context.push('/messages/' + Uri.encodeComponent(id));
    } catch (error) {
      if (_current(owner, epoch)) setState(() => _error = _errorMessage(error));
    } finally {
      if (_current(owner, epoch)) setState(() => _acting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final owner = session is SessionSignedIn ? session.user.id : null;
    if (_owner != owner) {
      ++_generation;
      ++_lookupEpoch;
      _owner = owner;
      _contacts = const [];
      _result = null;
      _error = null;
      _notice = null;
      _searching = false;
      _loading = false;
      _acting = false;
    }
    if (owner == null) {
      return const Scaffold(
        body: Center(child: Text('Sign in to find private contacts.')),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('New message')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: Color(0xFF128C7E),
                child: Icon(Icons.person_add_outlined, color: Colors.white),
              ),
              title: const Text('Load device contacts'),
              subtitle: const Text('Find your contacts on Masanawa'),
              trailing: _loading ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.chevron_right),
              onTap: _loading ? null : _loadContacts,
            ),
            const SizedBox(height: 12),
            TextField(
              key: const ValueKey('human-contact-handle'),
              controller: _handle,
              maxLength: 41,
              textCapitalization: TextCapitalization.none,
              autocorrect: false,
              decoration: InputDecoration(
                labelText: 'Person’s @handle',
                prefixIcon: const Icon(Icons.alternate_email),
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: _searching || _acting ? null : _search,
                ),
              ),
              onSubmitted: (_) => _search(),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _searching || _acting ? null : _search,
              icon: const Icon(Icons.search),
              label: const Text('Find person'),
            ),
            if (_searching || _loading || _acting)
              const LinearProgressIndicator(),
            if (_error != null)
              Semantics(
                liveRegion: true,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Text(_error!, key: const ValueKey('contact-error')),
                ),
              ),
            if (_notice != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Text(_notice!, key: const ValueKey('contact-notice')),
              ),
            if (_result case final candidate?)
              ListTile(
                key: const ValueKey('human-contact-result'),
                leading: const Icon(Icons.person_outline),
                title: Text(candidate.displayName),
                subtitle: Text('@' + candidate.handle),
                trailing: candidate.canMessage
                    ? FilledButton(
                        onPressed: _acting ? null : () => _open(candidate),
                        child: const Text('Message'),
                      )
                    : candidate.status == 'incoming' &&
                            candidate.requestRevision != null
                        ? Wrap(
                            spacing: 4,
                            children: [
                              TextButton(
                                onPressed: _acting ? null :
                                    () => _respond(candidate, false),
                                child: const Text('Decline'),
                              ),
                              FilledButton(
                                onPressed: _acting ? null :
                                    () => _respond(candidate, true),
                                child: const Text('Accept'),
                              ),
                            ],
                          )
                        : candidate.status == 'none' ||
                                candidate.status == 'revoked'
                            ? TextButton(
                                onPressed: _acting ? null :
                                    () => _requestContact(candidate),
                                child: const Text('Request contact'),
                              )
                            : Text(candidate.status == 'outgoing'
                                ? 'Waiting for approval'
                                : 'Messaging unavailable'),
              ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Expanded(child: Text('Your contacts',
                    style: TextStyle(fontWeight: FontWeight.bold))),
                IconButton(
                  tooltip: 'Refresh contacts',
                  onPressed: _loading ? null : _loadContacts,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            if (_contacts.isEmpty && !_loading)
              const Text('No accepted contacts yet. Find someone by handle.'),
            for (final person in _contacts)
              if (person.status == 'accepted')
                ListTile(
                  key: ValueKey('known-contact-' + person.userId),
                  leading: const Icon(Icons.person_outline),
                  title: Text(person.displayName),
                  subtitle: Text('@' + person.handle),
                  trailing: TextButton(
                    onPressed: _acting ? null : () => _open(person),
                    child: const Text('Message'),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

