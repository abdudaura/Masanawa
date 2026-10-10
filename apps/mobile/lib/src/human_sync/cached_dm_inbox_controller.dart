import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'dm_sync_coordinator.dart';

/// Gives C02's existing real-human Chats list an instant indexed local first
/// paint, without creating another route or fetching the AI chat cache.
class CachedDmInboxController extends ChangeNotifier {
  CachedDmInboxController(this.sync);

  final DmSyncCoordinator sync;
  List<Map<String, dynamic>> conversations = const [];
  bool readingCache = true;
  bool refreshing = false;
  String? error;
  bool _disposed = false;
  int _epoch = 0;

  void _notify() { if (!_disposed) notifyListeners(); }

  Future<void> restore() async {
    if (_disposed || !sync.active) return;
    final epoch = _epoch;
    try {
      final loaded = await sync.cache.inbox();
      if (_disposed || !sync.active || epoch != _epoch) return;
      conversations = loaded;
      error = null;
    } catch (_) {
      if (!_disposed && epoch == _epoch) error = 'Local chats unavailable; reconnect.';
    } finally {
      if (!_disposed && epoch == _epoch) {
        readingCache = false;
        _notify();
      }
    }
  }

  Future<void> refresh() async {
    if (_disposed || !sync.active || refreshing) return;
    refreshing = true; error = null; _notify();
    final epoch = _epoch;
    try {
      await sync.refreshInbox();
      if (_disposed || !sync.active || epoch != _epoch) return;
      conversations = await sync.cache.inbox();
    } on DioException catch (e) {
      if (!_disposed && epoch == _epoch) {
        if (e.response?.statusCode == 403) {
          conversations = const [];
          error = 'Chats unavailable; access was revoked.';
        } else {
          error = 'Could not update chats. Offline previews may be stale.';
        }
      }
    } catch (_) {
      if (!_disposed && epoch == _epoch) {
        if (!sync.active) conversations = const [];
        error = 'Could not update chats. Retry when connected.';
      }
    } finally {
      if (!_disposed && epoch == _epoch) {
        refreshing = false; _notify();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    super.dispose();
  }
}
