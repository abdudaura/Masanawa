import 'dart:async';
import 'package:flutter/foundation.dart';
import 'device_contacts_model.dart';

/// No disk persistence or Gateway calls. Caller supplies the current signed-in
/// account ID; changing account or disabling opt-in synchronously clears RAM.
class DeviceContactsController extends ChangeNotifier {
  DeviceContactsController({
    required DeviceContactsPlatform platform,
    required DeviceContactsInvite invite,
    required String? accountId,
  }) : _platform = platform, _invite = invite, _accountId = accountId;

  final DeviceContactsPlatform _platform;
  final DeviceContactsInvite _invite;
  String? _accountId;
  bool _disposed = false;
  int _epoch = 0;
  bool optedIn = false;
  bool busy = false;
  bool sharing = false;
  DeviceContactsPermission permission = DeviceContactsPermission.unknown;
  String? error;
  String search = '';
  List<DevicePhoneContact> contacts = const [];

  bool get canRead => optedIn && _accountId != null &&
      (permission == DeviceContactsPermission.granted ||
       permission == DeviceContactsPermission.limited);

  bool get needsSettings => permission == DeviceContactsPermission.permanentlyDenied ||
      permission == DeviceContactsPermission.restricted;

  bool get isSignedIn => _accountId != null;

  List<DevicePhoneContact> get visible {
    final query = search.toLowerCase().trim();
    if (query.isEmpty) return contacts;
    return contacts.where((p) => p.name.toLowerCase().contains(query)).toList(growable: false);
  }

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  void accountChanged(String? id) {
    if (id == _accountId) return;
    _epoch++;
    _accountId = id;
    optedIn = false;
    busy = false;
    sharing = false;
    permission = DeviceContactsPermission.unknown;
    error = null;
    search = '';
    contacts = const [];
    _emit();
  }

  void setSearch(String next) {
    search = next;
    _emit();
  }

  /// Called only by explicit user tap following the in-product rationale.
  Future<void> enable() async {
    if (busy || !isSignedIn) return;
    optedIn = true;
    await refresh(requestIfNeeded: true);
  }

  /// Revocation purges immediately even if the native permission is still set.
  void disable() {
    ++_epoch;
    optedIn = false;
    busy = false;
    sharing = false;
    contacts = const [];
    search = '';
    error = null;
    _emit();
  }

  /// Call on resume (OS permission may have been revoked in Settings).
  Future<void> refresh({bool requestIfNeeded = false}) async {
    if (!optedIn || !isSignedIn || busy) return;
    final epoch = ++_epoch;
    busy = true;
    error = null;
    _emit();
    try {
      var granted = await _platform.checkPermission();
      if (!_current(epoch)) return;
      if (requestIfNeeded && granted == DeviceContactsPermission.denied) {
        granted = await _platform.requestPermission();
      }
      if (!_current(epoch)) return;
      permission = granted;
      if (!canRead) {
        contacts = const [];
      } else {
        // Do not retain stale entries during an OS-level permission transition.
        contacts = const [];
        _emit();
        final loaded = await _platform.readContacts();
        if (!_current(epoch)) return;
        contacts = sanitizePhonebook(loaded);
      }
    } catch (_) {
      if (!_current(epoch)) return;
      contacts = const [];
      error = 'Phone contacts unavailable. Check permission and try again.';
    } finally {
      if (_current(epoch)) {
        busy = false;
        _emit();
      }
    }
  }

  bool _current(int epoch) =>
      !_disposed && _epoch == epoch && optedIn && _accountId != null;

  Future<void> openSettings() => _platform.openPermissionSettings();

  Future<void> invite(String deviceId, int numberIndex) async {
    // Contact and selected phone must be present in CURRENT local scope.
    if (!canRead || busy || sharing) return;
    final matches = contacts.where((p) => p.deviceId == deviceId);
    if (matches.isEmpty) return;
    final contact = matches.first;
    if (numberIndex < 0 || numberIndex >= contact.numbers.length) return;
    final epoch = _epoch;
    sharing = true;
    error = null;
    _emit();
    try {
      await _invite.sharePublicInvite();
      // No phone number or contact name is passed to share target.
    } catch (_) {
      if (_current(epoch)) error = 'Could not open the share sheet. Try again.';
    } finally {
      if (_current(epoch)) {
        sharing = false;
        _emit();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    ++_epoch;
    contacts = const [];
    super.dispose();
  }
}
