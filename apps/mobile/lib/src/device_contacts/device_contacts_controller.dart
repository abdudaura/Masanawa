import 'dart:async';
import 'package:flutter/foundation.dart';
import 'device_contacts_model.dart';
import 'device_contacts_consent_store.dart';

/// No disk persistence or Gateway calls. Caller supplies the current signed-in
/// account ID; changing account or disabling opt-in synchronously clears RAM.
class DeviceContactsController extends ChangeNotifier {
  DeviceContactsController({
    required DeviceContactsPlatform platform,
    required DeviceContactsInvite invite,
    required String? accountId,
    DeviceContactsConsentStore? consentStore,
  }) : _consentStore = consentStore, _platform = platform, _invite = invite, _accountId = accountId;

  final DeviceContactsConsentStore? _consentStore;
  final DeviceContactsPlatform _platform;
  final DeviceContactsInvite _invite;
  String? _accountId;
  bool _disposed = false;
  int _epoch = 0;
  bool optedIn = false;
  bool rememberedConsent = false;
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
    rememberedConsent = false;
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

  bool _sameAccount(int epoch, String owner) =>
      !_disposed && _epoch == epoch && _accountId == owner;

  /// Read only the boolean preference, never automatically scan the device on
  /// launch. A new visible tap is still needed before each view starts reading.
  Future<void> restoreConsent() async {
    final owner = _accountId;
    final store = _consentStore;
    if (owner == null || store == null || optedIn) return;
    final epoch = _epoch;
    try {
      final saved = await store.optedIn(owner);
      if (!_sameAccount(epoch, owner) || optedIn) return;
      rememberedConsent = saved;
      _emit();
    } catch (_) {
      // A failed secure-store read fails closed: no permission or phone IO.
    }
  }

  /// Called only by explicit user tap following the in-product rationale.
  Future<void> enable() async {
    final owner = _accountId;
    if (busy || optedIn || owner == null) return;
    final epoch = ++_epoch;
    busy = true;
    error = null;
    _emit();
    try {
      await _consentStore?.setOptedIn(owner, true);
      if (!_sameAccount(epoch, owner)) return;
      optedIn = true;
      rememberedConsent = true;
      busy = false;
      _emit();
      await refresh(requestIfNeeded: true);
    } catch (_) {
      if (_sameAccount(epoch, owner)) {
        busy = false;
        error = 'Could not save phone contacts consent securely.';
        _emit();
      }
    }
  }

  /// Revocation purges the OS directory synchronously; then removes consent.
  Future<void> disable() async {
    final owner = _accountId;
    ++_epoch;
    optedIn = false;
    rememberedConsent = false;
    busy = false;
    sharing = false;
    contacts = const [];
    search = '';
    error = null;
    _emit();
    if (owner == null) return;
    try {
      await _consentStore?.setOptedIn(owner, false);
    } catch (_) {
      if (!_disposed && _accountId == owner && !optedIn) {
        error = 'Contacts are off, but the saved preference could not be cleared.';
        _emit();
      }
    }
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
