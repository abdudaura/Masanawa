import 'dart:async';

import 'package:dio/dio.dart';

import 'protected_dm_cache.dart';

/// One authenticated account-scoped HTTP transport. C02 provides the real
/// Gateway adapter. NEVER implement a fake in production or use AI-chat APIs.
abstract class DmSyncTransport {
  Future<List<Map<String, dynamic>>> inbox();
  Future<List<Map<String, dynamic>>> history(String conversationId, {String? before});
  Future<Map<String, dynamic>> send(
      String conversationId, String requestId, String body);
  void cancelPendingRequests() {}
}

/// Verifies the current signed-in identity before and after awaited requests.
/// The host MUST dispose on logout/switch, and provide a session-pinned C02
/// transport (not a globally mutable bearer token) before enabling sends.
class DmSyncCoordinator {
  DmSyncCoordinator({
    required this.cache,
    required this.transport,
    required this.currentOwnerId,
    required this.currentTenantId,
  });
  final ProtectedDmCache cache;
  final DmSyncTransport transport;
  final String? Function() currentOwnerId;
  final String? Function() currentTenantId;
  bool _closed = false;
  final Set<String> _inFlight = {};

  bool get active => !_closed && currentOwnerId() == cache.ownerId &&
      currentTenantId() == cache.tenantId;

  void _requireActive() {
    if (!active) throw StateError('Authenticated DM owner changed');
  }

  /// Cached data is returned immediately by cache.inbox; this method updates
  /// with verified server results and reports failures without erasing cache.
  Future<List<Map<String, dynamic>>> refreshInbox() async {
    _requireActive();
    try {
      final data = await transport.inbox();
      _requireActive();
      await cache.putInbox(data);
      return data;
    } on DioException catch (error) {
      if (error.response?.statusCode == 401 ||
          error.response?.statusCode == 403) {
        await close();
        if (error.response?.statusCode == 403) {
          await ProtectedDmCache.wipeAccount(
              tenantId: cache.tenantId, ownerId: cache.ownerId);
        }
      }
      rethrow;
    }
  }

  /// C02's current REST history is keyset-paged; C03 will later own delta,
  /// notifications and catch-up. Never synthesize server cursor timestamps.
  Future<List<Map<String, dynamic>>> refreshThread(String conversationId,
      {String? before}) async {
    _requireActive();
    try {
      final page = await transport.history(conversationId, before: before);
      _requireActive();
      await cache.putMessages(conversationId, page);
      return page;
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        await close();
      } else if (error.response?.statusCode == 403 ||
          error.response?.statusCode == 404) {
        // A verified server denial revokes all cached content for this thread.
        await cache.revokeConversation(conversationId);
      }
      rethrow;
    }
  }

  /// The UI should first create a stable requestId and queue the message.
  /// This function deliberately does NOT claim delivery while offline.
  Future<void> enqueue({
    required String conversationId,
    required String requestId,
    required String text,
  }) async {
    _requireActive();
    await cache.queue(conversationId: conversationId,
        requestId: requestId, text: text);
    _requireActive();
  }

  /// No automatic retry on authentication errors, new session or definitive
  /// rejection. Uncertain errors retain the original request ID for retry.
  Future<DmSendOutcome> sendOnce(DmQueuedMessage item) async {
    _requireActive();
    if (!_inFlight.add(item.requestId)) return DmSendOutcome.inFlight;
    try {
      final serverMessage = await transport.send(
          item.conversationId, item.requestId, item.text);
      _requireActive();
      await cache.acknowledge(item.requestId, serverMessage);
      return DmSendOutcome.confirmed;
    } on DioException catch (error) {
      if (!active) return DmSendOutcome.accountChanged;
      final status = error.response?.statusCode;
      if (status == 401 || status == 403 || status == 404 ||
          status == 409 || status == 422) {
        await cache.mark(item.requestId, 'rejected');
        if (status == 401) await close();
        return DmSendOutcome.rejected;
      }
      await cache.mark(item.requestId, 'uncertain');
      return DmSendOutcome.uncertain;
    } on FormatException {
      if (!active) return DmSendOutcome.accountChanged;
      // A mismatched server principal/request ACK is a security anomaly.
      // Do not automatically repeat the request or fabricate confirmation.
      await cache.mark(item.requestId, 'rejected');
      return DmSendOutcome.rejected;
    } on StateError {
      return DmSendOutcome.accountChanged;
    } catch (_) {
      if (!active) return DmSendOutcome.accountChanged;
      await cache.mark(item.requestId, 'uncertain');
      return DmSendOutcome.uncertain;
    } finally {
      _inFlight.remove(item.requestId);
    }
  }

  /// Explicit foreground retry only; network and session lifecycle owner
  /// C03 will supply policy for background scheduling/notifications.
  Future<List<DmSendOutcome>> retryPending() async {
    _requireActive();
    final items = await cache.pending();
    final results = <DmSendOutcome>[];
    for (final item in items) {
      if (!active) break;
      if (item.state == 'rejected') continue;
      results.add(await sendOnce(item));
    }
    return results;
  }

  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    transport.cancelPendingRequests();
    await cache.close();
  }
}

enum DmSendOutcome { confirmed, uncertain, rejected, accountChanged, inFlight }
