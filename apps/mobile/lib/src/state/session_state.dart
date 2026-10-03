import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/api/models.dart';
import '../core/network/api_client.dart';
import '../core/providers.dart';

/// Secure keychain/keystore for the token pair + profile.
///
/// Never in local DB / plain prefs. Android uses EncryptedSharedPreferences;
/// iOS uses first-unlock-this-device accessibility.
const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(encryptedSharedPreferences: true),
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
  ),
);
const _kAccess = 'auth_access_token';
const _kRefresh = 'auth_refresh_token';
const _kUser = 'auth_user';
const _kExpiry = 'auth_access_expires_in';

/// Auth session state machine. `restoring` / `signedOut` → `sending` → `awaitingOtp` →
/// (`signedIn` | error).
sealed class SessionState {
  const SessionState();
}

class SessionSignedOut extends SessionState {
  const SessionSignedOut();
}

class SessionRestoring extends SessionState {
  const SessionRestoring();
}

class SessionSendingOtp extends SessionState {
  const SessionSendingOtp(this.channel, this.identifier);
  final OtpChannel channel;
  final String identifier;
}

class SessionAwaitingOtp extends SessionState {
  const SessionAwaitingOtp(this.channel, this.identifier, this.resendInSeconds);
  final OtpChannel channel;
  final String identifier;
  final int resendInSeconds;
}

class SessionVerifying extends SessionState {
  const SessionVerifying(this.channel, this.identifier);
  final OtpChannel channel;
  final String identifier;
}

/// First signup: the backend requires a name before the account is created
/// (auth.service.ts: `NAME_REQUIRED_ON_SIGNUP`). Carries the channel +
/// identifier + code so the name screen can complete verification with the
/// same OTP.
class SessionNameRequired extends SessionState {
  const SessionNameRequired(this.channel, this.identifier, this.code);
  final OtpChannel channel;
  final String identifier;
  final String code;
}

class SessionSignedIn extends SessionState {
  const SessionSignedIn(this.user, this.tokens);
  final AuthUser user;
  final AuthTokens tokens;
}

class SessionError extends SessionState {
  const SessionError(
    this.message, {
    this.code,
    this.channel,
    this.identifier,
    this.resendInSeconds,
  });
  final String message;
  final String? code;
  final OtpChannel? channel;
  final String? identifier;
  final int? resendInSeconds;
}

const String kAlphaDevAccessToken = String.fromEnvironment(
  'ALPHA_DEV_ACCESS_TOKEN',
  defaultValue: '',
);

/// Dev sessions carry either the build-provided Alpha token or a local
/// `dev-` prefix. Release builds still cannot invoke devLogin.
bool isDevAccessToken(String? token) =>
    token != null &&
    (token.startsWith('dev-') ||
        (kAlphaDevAccessToken.isNotEmpty && token == kAlphaDevAccessToken));

class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() {
    _restore();
    return const SessionRestoring();
  }

  Future<void> _restore() async {
    try {
      final stored = await _readPersisted();
      if (stored == null) {
        state = const SessionSignedOut();
        return;
      }
      final client = ref.read(apiClientProvider);
      client.accessToken = stored.accessToken;
      // Dev sessions never hit the refresh endpoint: a 401 simply surfaces
      // as an error and the local session stays put.
      client.onUnauthorized =
          isDevAccessToken(stored.accessToken) ? () async => null : _rotateOn401;
      state = SessionSignedIn(stored.user, stored);
    } catch (_) {
      state = const SessionSignedOut();
    }
  }

  Future<void> sendOtp({String? phone, String? email}) async {
    final channel = phone != null ? OtpChannel.sms : OtpChannel.email;
    final identifier = phone ?? email!;
    state = SessionSendingOtp(channel, identifier);
    try {
      final res =
          await ref.read(apiClientProvider).otpSend(phone: phone, email: email);
      state = SessionAwaitingOtp(res.channel, res.identifier, res.resendInSeconds);
    } catch (e) {
      final err = e is ApiException ? e : const ApiException('Could not send verification code');
      state = SessionError(err.message,
          code: err.code, channel: channel, identifier: identifier);
    }
  }

  Future<void> verifyOtp(
    String code, {
    String? phone,
    String? email,
    String? name,
  }) async {
    final channel = phone != null ? OtpChannel.sms : OtpChannel.email;
    final identifier = phone ?? email!;
    state = SessionVerifying(channel, identifier);
    try {
      final tokens = await ref
          .read(apiClientProvider)
          .otpVerify(code, phone: phone, email: email, name: name);
      await _persist(tokens);
      state = SessionSignedIn(tokens.user, tokens);
    } on ApiException catch (e) {
      if (e.code == 'NAME_REQUIRED_ON_SIGNUP' || e.message.contains('NAME_REQUIRED')) {
        state = SessionNameRequired(channel, identifier, code);
        return;
      }
      state = SessionError(e.message,
          code: e.code, channel: channel, identifier: identifier);
    } catch (e) {
      final err =
          e is ApiException ? e : const ApiException('Could not verify code');
      state = SessionError(err.message,
          code: err.code, channel: channel, identifier: identifier);
    }
  }

  /// Clears a verify/send error back to `awaitingOtp` so the user can correct
  /// the code and retry.
  void clearVerifyError({
    required OtpChannel channel,
    required String identifier,
    int resendInSeconds = 0,
  }) {
    if (state is SessionError) {
      state = SessionAwaitingOtp(channel, identifier, resendInSeconds);
    }
  }

  Future<void> refresh() async {
    final stored = await _readPersisted();
    if (stored == null) return;
    if (isDevAccessToken(stored.accessToken)) {
      // Local dev session — nothing to rotate; re-emit so it stays signed in.
      state = SessionSignedIn(stored.user, stored);
      return;
    }
    try {
      final rotated =
          await ref.read(apiClientProvider).refresh(stored.refreshToken);
      await _persist(rotated);
      state = SessionSignedIn(rotated.user, rotated);
    } catch (_) {
      await _clear();
      state = const SessionSignedOut();
    }
  }

  /// Rotation callback consumed by the ApiClient 401 interceptor.
  Future<String?> _rotateOn401() async {
    await refresh();
    if (state is SessionSignedIn) {
      return (state as SessionSignedIn).tokens.accessToken;
    }
    return null;
  }

  /// Local dev sign-in — debug/test only, never in release.
  ///
  /// Production phone login must go through `sendOtp(phone:)` + `verifyOtp`.
  /// This helper exists so widget tests and local debug builds can open the
  /// shell without an OTP service. Release UI must never call it (guarded by
  /// kDebugMode below).
  Future<void> devLogin({
    String? phone,
    String? email,
    String? name,
    String? countryIso,
  }) async {
    if (!kDebugMode) {
      throw StateError('devLogin is debug-only; use OTP verify in release.');
    }
    final now = DateTime.now().toUtc().toIso8601String();
    final displayName = (name ?? '').trim();
    final user = AuthUser(
      id: 'dev-${DateTime.now().microsecondsSinceEpoch}',
      name: displayName,
      phone: phone,
      email: email,
      locale: (countryIso ?? 'NG').toLowerCase(),
      status: 'ACTIVE',
      role: 'USER',
      isNewUser: displayName.isEmpty,
      createdAt: now,
    );
    final stamp = DateTime.now().microsecondsSinceEpoch;
    final tokens = AuthTokens(
      accessToken: kAlphaDevAccessToken.isNotEmpty
          ? kAlphaDevAccessToken
          : 'dev-access-$stamp',
      refreshToken: 'dev-refresh-$stamp',
      accessExpiresIn: 86400,
      user: user,
    );
    await _persist(tokens);
    state = SessionSignedIn(user, tokens);
  }

  /// Completes a dev registration (name + email) after a phone login.
  Future<void> updateDevProfile({
    required String name,
    String? email,
  }) async {
    final current = state;
    if (current is! SessionSignedIn) return;
    if (!isDevAccessToken(current.tokens.accessToken)) return;
    final cleanName = name.trim();
    if (cleanName.isEmpty) return;
    final cleanEmail = (email ?? '').trim();
    final user = AuthUser(
      id: current.user.id,
      name: cleanName,
      phone: current.user.phone,
      email: cleanEmail.isEmpty ? current.user.email : cleanEmail,
      locale: current.user.locale,
      status: current.user.status,
      role: current.user.role,
      isNewUser: false,
      communityId: current.user.communityId,
      stateId: current.user.stateId,
      createdAt: current.user.createdAt,
    );
    final tokens = AuthTokens(
      accessToken: current.tokens.accessToken,
      refreshToken: current.tokens.refreshToken,
      accessExpiresIn: current.tokens.accessExpiresIn,
      user: user,
    );
    await _persist(tokens);
    state = SessionSignedIn(user, tokens);
  }

  Future<void> logout() async {
    try {
      await ref.read(apiClientProvider).logout();
    } catch (_) {
      // Best effort — always clear locally.
    }
    await _clear();
    state = const SessionSignedOut();
  }

  Future<void> _persist(AuthTokens tokens) async {
    final client = ref.read(apiClientProvider);
    client.accessToken = tokens.accessToken;
    client.onUnauthorized =
        isDevAccessToken(tokens.accessToken) ? () async => null : _rotateOn401;
    await _storage.write(key: _kAccess, value: tokens.accessToken);
    await _storage.write(key: _kRefresh, value: tokens.refreshToken);
    await _storage.write(
      key: _kExpiry,
      value: tokens.accessExpiresIn.toString(),
    );
    await _storage.write(
      key: _kUser,
      value: jsonEncode(tokens.user.toJson()),
    );
  }

  Future<AuthTokens?> _readPersisted() async {
    final access = await _storage.read(key: _kAccess);
    final refresh = await _storage.read(key: _kRefresh);
    final userRaw = await _storage.read(key: _kUser);
    if (access == null || refresh == null || userRaw == null) return null;
    // Empty tokens from a failed write must not restore a ghost session.
    if (access.isEmpty || refresh.isEmpty) return null;
    try {
      final user = AuthUser.fromJson(jsonDecode(userRaw) as Map<String, dynamic>);
      // Real expiry when present; fall back to 15 min only for legacy rows
      // written before U-SHELL-02 (no expiry key stored).
      final expiryRaw = await _storage.read(key: _kExpiry);
      final expiry = int.tryParse(expiryRaw ?? '') ?? 900;
      return AuthTokens(
        accessToken: access,
        refreshToken: refresh,
        accessExpiresIn: expiry,
        user: user,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _clear() async {
    final client = ref.read(apiClientProvider);
    client.accessToken = null;
    client.onUnauthorized = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kExpiry);
    await _storage.delete(key: _kUser);
  }
}

final sessionProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

/// Derives "is signed in" for the router redirect.
final isSignedInProvider = Provider<bool>((ref) {
  return ref.watch(sessionProvider) is SessionSignedIn;
});