import 'package:flutter/foundation.dart';

/// An OS notification preference is not proof of remote push delivery.
/// This controller never assumes an OS permission request or failed transport
/// call succeeded; callers must still reconcile the server/device token.
class NotificationSwitchController extends ChangeNotifier {
  NotificationSwitchController({
    required Future<bool> Function() readEnabled,
    required Future<bool> Function() requestPermission,
    required Future<void> Function() unregister,
  }) : _readEnabled = readEnabled,
       _requestPermission = requestPermission,
       _unregister = unregister;

  final Future<bool> Function() _readEnabled;
  final Future<bool> Function() _requestPermission;
  final Future<void> Function() _unregister;
  String? _accountId;
  int _generation = 0;
  bool _disposed = false;

  bool enabled = false;
  bool loading = false;
  bool saving = false;
  String? error;

  String? get accountId => _accountId;
  bool get canChange => _accountId != null && !loading && !saving;

  void _publish() {
    if (!_disposed) notifyListeners();
  }

  bool _current(int generation, String? account) =>
      !_disposed && generation == _generation && account == _accountId;

  /// A changed signed-in account invalidates every older read/write callback.
  /// Does not switch the native push identity: that is owned by the shell.
  Future<void> bind(String? accountId) async {
    if (accountId == _accountId) return;
    _accountId = accountId;
    final generation = ++_generation;
    enabled = false;
    loading = accountId != null;
    saving = false;
    error = null;
    _publish();
    if (accountId == null) return;
    await _load(generation, accountId);
  }

  Future<void> refresh() async {
    final account = _accountId;
    if (account == null || saving || loading) return;
    final generation = ++_generation;
    loading = true;
    error = null;
    _publish();
    await _load(generation, account);
  }

  Future<void> _load(int generation, String account) async {
    try {
      final value = await _readEnabled();
      if (!_current(generation, account)) return;
      enabled = value;
    } catch (_) {
      if (!_current(generation, account)) return;
      // An unknown device permission state must not display a true switch.
      enabled = false;
      error = 'Could not check notification permissions. Retry to refresh.';
    } finally {
      if (_current(generation, account)) {
        loading = false;
        _publish();
      }
    }
  }

  /// Returns false for an ignored, denied, uncertain, or failed transition.
  /// No optimistic switch update: verify device state after every operation.
  Future<bool> change(bool requested) async {
    final account = _accountId;
    if (account == null || !canChange) return false;
    if (requested == enabled) return true;
    final generation = _generation;
    saving = true;
    error = null;
    _publish();
    try {
      if (requested) {
        final granted = await _requestPermission();
        if (!_current(generation, account)) return false;
        if (!granted) {
          error = 'Notification permission is off. Enable it in device settings.';
          return false;
        }
      } else {
        await _unregister();
        if (!_current(generation, account)) return false;
      }
      final confirmed = await _readEnabled();
      if (!_current(generation, account)) return false;
      enabled = confirmed;
      if (confirmed != requested) {
        error = 'Notification change was not confirmed. Check permissions and retry.';
        return false;
      }
      return true;
    } catch (_) {
      if (_current(generation, account)) {
        error = 'Could not update notifications. Check your connection and retry.';
      }
      return false;
    } finally {
      if (_current(generation, account)) {
        saving = false;
        _publish();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    super.dispose();
  }
}
