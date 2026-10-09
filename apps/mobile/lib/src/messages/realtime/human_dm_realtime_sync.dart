import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';

import 'human_dm_realtime_transport.dart';
import '../../core/network/api_client.dart';

/// Storage is owned by C05's protected per-tenant/per-user cache. The cursor
/// MUST be written only AFTER its corresponding server events have been applied.
abstract interface class HumanDmRealtimeCursorStore {
  Future<String?> load({required String tenantId, required String userId});
  Future<void> save({
    required String tenantId,required String userId,required String cursor,
  });
}

/// The C02/C05 integration owner provides operations backed by real Gateway
/// history/inbox and the protected cache. Event metadata alone is not a DM.
abstract interface class HumanDmRealtimeProjection {
  Future<void> refreshAll();
  Future<void> refreshConversation(String conversationId);
  /// The server's monotone reader cursor, not a client-predicted receipt.
  Future<void> applyReadReceipt({
    required String conversationId,required String readerUserId,
    required String throughSequence,
  });
  /// Re-evaluate current C02 authority and evict no-longer-permitted content.
  Future<void> invalidateConversation(String conversationId);
}

enum HumanDmRealtimeStatus { connecting, synchronized, retrying, authenticationRequired, stopped }

class HumanDmRealtimeSync {
  HumanDmRealtimeSync({
    required this.tenantId,
    required this.userId,
    required this.transport,
    required this.store,
    required this.projection,
    required bool Function() isCurrentSession,
    Future<void> Function(Duration duration)? sleep,
    int Function(int exclusiveMax)? random,
    this.onStatus,
  }) : _isCurrentSession = isCurrentSession,
       _sleep = sleep ?? Future<void>.delayed,
       _random = random ?? Random.secure().nextInt;

  final String tenantId;
  final String userId;
  final void Function(HumanDmRealtimeStatus status)? onStatus;
  final HumanDmRealtimeTransport transport;
  final HumanDmRealtimeCursorStore store;
  final HumanDmRealtimeProjection projection;
  final bool Function() _isCurrentSession;
  final Future<void> Function(Duration duration) _sleep;
  final int Function(int exclusiveMax) _random;

  bool _active = true;
  bool _bootstrapped = false;
  String? _cursor;
  Future<void>? _inflight;
  Future<void>? _foregroundRun;
  CancelToken? _cancel;
  int _failureCount = 0;

  bool get active => _active && _isCurrentSession();

  void stop() {
    _active = false;
    _cancel?.cancel('human DM session ended');
    onStatus?.call(HumanDmRealtimeStatus.stopped);
  }
  void _checkActive() {
    if (!active) throw StateError('Human messaging session no longer active');
  }

  /// One bounded server sync. No call is started automatically on widget
  /// construction. Foreground/message-screen lifecycle explicitly starts it.
  Future<void> syncOnce({int waitMs = 0}) {
    _checkActive();
    final current = _inflight;
    if (current != null) return current;
    final next = _syncOnce(waitMs);
    _inflight = next;
    return next.whenComplete(() {
      if (identical(_inflight,next)) _inflight = null;
    });
  }

  Future<void> _syncOnce(int waitMs) async {
    _checkActive();
    if (!_bootstrapped) {
      _cursor = await store.load(tenantId:tenantId,userId:userId);
      _checkActive();
      // No cursor means initial C02 inbox/history bootstrap is mandatory.
      if (_cursor == null) {
        await projection.refreshAll();
        _checkActive();
      }
      _bootstrapped = true;
    }
    final cancel = CancelToken();
    _cancel = cancel;
    try {
      // Bound each pass to five 50-event pages. Remaining events are picked
      // up on the next pass, preserving persisted cursor correctness.
      for (var i=0;i<5;i++) {
        _checkActive();
        final page = await transport.poll(
          cursor:_cursor,limit:50,
          waitMs:i==0 ? waitMs : 0,
          cancelToken:cancel,
        );
        _checkActive();
        if (page.resetRequired && _cursor != null) {
          await projection.refreshAll();
          _checkActive();
        }
        final previous = int.parse(_cursor ?? '0');
        if (int.parse(page.nextCursor) < previous ||
            (page.hasMore && page.events.isEmpty)) {
          throw const FormatException('Invalid private message sync advance');
        }
        // Group repeated message events by thread; access changes take
        // precedence. Fresh membership is resolved by the C02 authority.
        final changedThreads = <String>{};
        final revoked = <String>{};
        final reads = <String,List<HumanDmRealtimeEvent>>{};
        for (final event in page.events) {
          if (event.kind == HumanDmChange.accessChanged) {
            revoked.add(event.conversationId);
          } else if (event.kind == HumanDmChange.readChanged) {
            reads.putIfAbsent(event.conversationId, () => []).add(event);
          } else {
            changedThreads.add(event.conversationId);
          }
        }
        final affected = <String>{
          ...changedThreads,...revoked,...reads.keys,
        };
        for (final conversationId in affected) {
          _checkActive();
          if (revoked.contains(conversationId)) {
            await projection.invalidateConversation(conversationId);
          } else {
            if (changedThreads.contains(conversationId)) {
              await projection.refreshConversation(conversationId);
            }
            for (final read in reads[conversationId] ??
                const <HumanDmRealtimeEvent>[]) {
              _checkActive();
              await projection.applyReadReceipt(
                conversationId:conversationId,
                readerUserId:read.actorUserId,
                throughSequence:read.messageSequence!,
              );
            }
          }
          _checkActive();
        }
        // This save is the ONLY durable acknowledgement: no event is
        // acknowledged just because HTTP succeeded or a push arrived.
        await store.save(
          tenantId:tenantId,userId:userId,cursor:page.nextCursor,
        );
        _checkActive();
        _cursor = page.nextCursor;
        if (!page.hasMore) break;
      }
      _failureCount = 0;
    } finally {
      if (identical(_cancel,cancel)) _cancel = null;
    }
  }

  /// Runs only when the authenticated UI lifecycle explicitly requests it.
  /// Do not run a foreground poll loop from an app-killed/background isolate.
  /// Concurrent foreground listeners share one loop, rather than starting
  /// overlapping polls/backoffs against the same protected C05 cursor.
  Future<void> runWhileForeground() {
    _checkActive();
    final existing = _foregroundRun;
    if (existing != null) return existing;

    // Schedule after storing the shared future so a status listener cannot
    // re-enter and start a second loop. An immediate sign-out before the
    // microtask must end quietly, without opening a network request.
    late final Future<void> task;
    task = Future<void>.microtask(() async {
      if (!active) return;
      await _runForegroundLoop();
    }).whenComplete(() {
      if (identical(_foregroundRun, task)) _foregroundRun = null;
    });
    _foregroundRun = task;
    return task;
  }

  Future<void> _runForegroundLoop() async {
    if (!active) return;
    onStatus?.call(HumanDmRealtimeStatus.connecting);
    while (active) {
      try {
        await syncOnce(waitMs:12000);
        if (!active) return;
        onStatus?.call(HumanDmRealtimeStatus.synchronized);
        await _sleep(const Duration(milliseconds: 250));
      } on DioException catch (error) {
        if (!active || CancelToken.isCancel(error)) return;
        if (error.response?.statusCode == 401 ||
            error.response?.statusCode == 403) {
          // A revoked session must not loop forever or attempt a new
          // authenticated account's messages on the old cursor.
          _active = false;
          onStatus?.call(HumanDmRealtimeStatus.authenticationRequired);
          return;
        }
        _failureCount++;
        onStatus?.call(HumanDmRealtimeStatus.retrying);
        await _sleep(_backoff());
      } on ApiException catch (error) {
        if (!active) return;
        if (error.statusCode == 401 || error.statusCode == 403) {
          _active = false;
          onStatus?.call(HumanDmRealtimeStatus.authenticationRequired);
          return;
        }
        _failureCount++;
        onStatus?.call(HumanDmRealtimeStatus.retrying);
        await _sleep(_backoff());
      } on StateError {
        if (!active) return;
        _failureCount++;
        onStatus?.call(HumanDmRealtimeStatus.retrying);
        await _sleep(_backoff());
      } catch (_) {
        if (!active) return;
        _failureCount++;
        onStatus?.call(HumanDmRealtimeStatus.retrying);
        await _sleep(_backoff());
      }
    }
  }

  Duration _backoff() {
    final exponent = min(_failureCount,6);
    final base = min(60000,500 * (1 << exponent));
    return Duration(milliseconds:base + _random(max(1,base ~/ 2)));
  }
}
