import 'dart:math';

import '../core/network/api_client.dart';
import 'talk_gift.dart';
import 'talk_gift_pending_store.dart';

/// Sends gifts using one durable request ID per pending, explicitly confirmed
/// selection. An uncertain outcome can be retried after an APK/process restart
/// without authorizing a fresh transfer.
class GatewayTalkGiftTransport implements TalkGiftTransport {
  GatewayTalkGiftTransport({
    required this.api,
    DateTime Function()? now,
    TalkGiftPendingStore? pendingStore,
    String? pendingOwnerId,
    String? Function()? activeUserId,
  })  : _now = now ?? DateTime.now,
        _pendingStore = pendingStore,
        _pendingOwnerId = pendingOwnerId,
        _activeUserId = activeUserId;

  final ApiClient api;
  final DateTime Function() _now;
  final TalkGiftPendingStore? _pendingStore;
  final String? _pendingOwnerId;
  final String? Function()? _activeUserId;
  int _sequence = 0;
  final Random _random = Random.secure();

  // Non-persistent mode is retained for transport tests and older embeddings.
  final Map<String, String> _pendingRequestIds = {};
  final Map<String, Future<TalkGiftReceipt>> _inFlight = {};

  String _requestId() {
    _sequence += 1;
    return 'talk-gift-${_now().microsecondsSinceEpoch}-$_sequence-${_random.nextInt(0x100000000)}-${_random.nextInt(0x100000000)}';
  }

  Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw const FormatException('Invalid Talk gift response');
  }

  @override
  Future<TalkGiftCatalog> loadCatalog({required String talkId}) async {
    final id = talkId.trim();
    if (id.isEmpty) throw const FormatException('Talk id is required');
    final response = await api.dio.get<dynamic>(
      '/talks/${Uri.encodeComponent(id)}/gifts/catalog',
    );
    final catalog = TalkGiftCatalog.fromJson(_map(response.data));
    if (catalog.talkId != id) {
      throw const FormatException('Mismatched gift catalog Talk');
    }
    return catalog;
  }

  String? _verifiedOwner() {
    if (_pendingStore == null) return null;
    final owner = _pendingOwnerId?.trim();
    if (owner == null || owner.isEmpty ||
        (_activeUserId != null && _activeUserId() != owner)) {
      throw StateError('Sign in again before sending a gift.');
    }
    return owner;
  }

  Future<String> _loadOrCreateRequestId(String fingerprint) async {
    final owner = _verifiedOwner();
    final store = _pendingStore;
    if (owner == null || store == null) {
      return _pendingRequestIds.putIfAbsent(fingerprint, _requestId);
    }

    // Read-before-write is serialized by _inFlight for the same task.
    // Persist prior to POST; a storage failure must never send a new debit.
    final saved = await store.read(userId: owner, fingerprint: fingerprint);
    if (saved != null &&
        !RegExp(r'^(pending|completed):talk-gift-[0-9]+(?:-[0-9]+){3}            .hasMatch(saved)) {
      throw const FormatException('Gift recovery state is invalid');
    }
    if (saved != null && saved.startsWith('pending:')) {
      return saved.substring('pending:'.length);
    }

    final requestId = _requestId();
    await store.write(
      userId: owner,
      fingerprint: fingerprint,
      record: 'pending:$requestId',
    );
    return requestId;
  }

  Future<void> _markCompleted(String fingerprint, String requestId) async {
    final owner = _verifiedOwner();
    final store = _pendingStore;
    if (owner != null && store != null) {
      // Do not discard the idempotency key before the settlement is known.
      // On restart, 'pending' replays; 'completed' makes the next deliberate
      // send a new gift, rather than replaying the old transfer forever.
      await store.write(
        userId: owner,
        fingerprint: fingerprint,
        record: 'completed:$requestId',
      );
    }
    _pendingRequestIds.remove(fingerprint);
  }

  @override
  Future<TalkGiftReceipt> sendGift({
    required String talkId,
    required int amountCredits,
    String? catalogItemId,
  }) async {
    final normalizedTalkId = talkId.trim();
    if (normalizedTalkId.isEmpty) {
      throw const FormatException('Talk id is required');
    }
    if (amountCredits < 1 || amountCredits > 1000000000000) {
      throw const FormatException('Gift amount is invalid');
    }
    final normalizedItemId = catalogItemId?.trim();
    if (catalogItemId != null &&
        (normalizedItemId == null ||
            !RegExp(r'^[a-z][a-z0-9_-]{0,47}$').hasMatch(normalizedItemId))) {
      throw const FormatException('Gift option is invalid');
    }

    final fingerprint = [
      normalizedTalkId, normalizedItemId ?? '-',
      amountCredits.toString(),
    ].join(':');

    // Avoid two near-simultaneous confirmation actions racing their durable
    // read and producing different idempotency keys for one selection.
    final existing = _inFlight[fingerprint];
    if (existing != null) return existing;
    final execution = _send(
      fingerprint: fingerprint,
      talkId: normalizedTalkId,
      amountCredits: amountCredits,
      catalogItemId: normalizedItemId,
    );
    _inFlight[fingerprint] = execution;
    try {
      return await execution;
    } finally {
      if (identical(_inFlight[fingerprint], execution)) {
        _inFlight.remove(fingerprint);
      }
    }
  }

  Future<TalkGiftReceipt> _send({
    required String fingerprint,
    required String talkId,
    required int amountCredits,
    String? catalogItemId,
  }) async {
    final requestId = await _loadOrCreateRequestId(fingerprint);
    _verifiedOwner(); // Guard against account switching during secure IO.
    final response = await api.dio.post<dynamic>(
      '/talks/${Uri.encodeComponent(talkId)}/gifts',
      data: {
        'requestId': requestId,
        'amountCredits': amountCredits,
        if (catalogItemId != null) 'catalogItemId': catalogItemId,
      },
    );

    final receipt = TalkGiftReceipt.fromJson(_map(response.data));
    if (receipt.talkId != talkId ||
        receipt.amountCredits != amountCredits ||
        (catalogItemId != null && receipt.catalogItemId != catalogItemId)) {
      // Idempotency state remains pending for an authoritative retry.
      throw const FormatException('Gift receipt does not match confirmed terms');
    }
    await _markCompleted(fingerprint, requestId);
    return receipt;
  }
}
)
            .hasMatch(saved)) {
      throw const FormatException('Gift recovery state is invalid');
    }
    if (saved != null && saved.startsWith('pending:')) {
      return saved.substring('pending:'.length);
    }

    final requestId = _requestId();
    await store.write(
      userId: owner,
      fingerprint: fingerprint,
      record: 'pending:$requestId',
    );
    return requestId;
  }

  Future<void> _markCompleted(String fingerprint, String requestId) async {
    final owner = _verifiedOwner();
    final store = _pendingStore;
    if (owner != null && store != null) {
      // Do not discard the idempotency key before the settlement is known.
      // On restart, 'pending' replays; 'completed' makes the next deliberate
      // send a new gift, rather than replaying the old transfer forever.
      await store.write(
        userId: owner,
        fingerprint: fingerprint,
        record: 'completed:$requestId',
      );
    }
    _pendingRequestIds.remove(fingerprint);
  }

  @override
  Future<TalkGiftReceipt> sendGift({
    required String talkId,
    required int amountCredits,
    String? catalogItemId,
  }) async {
    final normalizedTalkId = talkId.trim();
    if (normalizedTalkId.isEmpty) {
      throw const FormatException('Talk id is required');
    }
    if (amountCredits < 1 || amountCredits > 1000000000000) {
      throw const FormatException('Gift amount is invalid');
    }
    final normalizedItemId = catalogItemId?.trim();
    if (catalogItemId != null &&
        (normalizedItemId == null ||
            !RegExp(r'^[a-z][a-z0-9_-]{0,47}$').hasMatch(normalizedItemId))) {
      throw const FormatException('Gift option is invalid');
    }

    final fingerprint = [
      normalizedTalkId, normalizedItemId ?? '-',
      amountCredits.toString(),
    ].join(':');

    // Avoid two near-simultaneous confirmation actions racing their durable
    // read and producing different idempotency keys for one selection.
    final existing = _inFlight[fingerprint];
    if (existing != null) return existing;
    final execution = _send(
      fingerprint: fingerprint,
      talkId: normalizedTalkId,
      amountCredits: amountCredits,
      catalogItemId: normalizedItemId,
    );
    _inFlight[fingerprint] = execution;
    try {
      return await execution;
    } finally {
      if (identical(_inFlight[fingerprint], execution)) {
        _inFlight.remove(fingerprint);
      }
    }
  }

  Future<TalkGiftReceipt> _send({
    required String fingerprint,
    required String talkId,
    required int amountCredits,
    String? catalogItemId,
  }) async {
    final requestId = await _loadOrCreateRequestId(fingerprint);
    _verifiedOwner(); // Guard against account switching during secure IO.
    final response = await api.dio.post<dynamic>(
      '/talks/${Uri.encodeComponent(talkId)}/gifts',
      data: {
        'requestId': requestId,
        'amountCredits': amountCredits,
        if (catalogItemId != null) 'catalogItemId': catalogItemId,
      },
    );

    final receipt = TalkGiftReceipt.fromJson(_map(response.data));
    if (receipt.talkId != talkId ||
        receipt.amountCredits != amountCredits ||
        (catalogItemId != null && receipt.catalogItemId != catalogItemId)) {
      // Idempotency state remains pending for an authoritative retry.
      throw const FormatException('Gift receipt does not match confirmed terms');
    }
    await _markCompleted(fingerprint, requestId);
    return receipt;
  }
}
