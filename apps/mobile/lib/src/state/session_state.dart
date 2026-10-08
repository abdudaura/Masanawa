import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/api/models.dart';
import '../core/network/api_client.dart';
import '../core/providers.dart';

const _storage = FlutterSecureStorage(
  aOptions: AndroidOptions(),
  iOptions: IOSOptions(
    accessibility: KeychainAccessibility.first_unlock_this_device,
  ),
);
const _kSession = 'auth_session_v2';
const _kAccess = 'auth_access_token';
const _kRefresh = 'auth_refresh_token';
const _kUser = 'auth_user';
const _kExpiry = 'auth_access_expires_in';

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

class SessionNameRequired extends SessionState {
  const SessionNameRequired(
    this.channel,
    this.identifier,
    this.code, {
    this.message,
  });
  final OtpChannel channel;
  final String identifier;
  final String code;
  final String? message;
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

class SessionController extends Notifier<SessionState> {
  // Each new auth operation cancels older responses, including responses
  // arriving after logout or a new OTP request. No response may authenticate
  // a different current session simply because its network call finished last.
  int _authGeneration = 0;
  bool _loggingOut = false;

  // Serializes native credential writes, migration, and logout deletion.
  // A pending verify write may finish after logout starts, but logout deletion
  // always follows it; a stale writer may never recreate the session later.
  Future<void> _credentialOps = Future<void>.value();

  Future<T> _withCredentialLock<T>(Future<T> Function() task) {
    final result = _credentialOps.then((_) => task());
    _credentialOps = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace __) {},
    );
    return result;
  }

  @override
  SessionState build() {
    _restore();
    return const SessionRestoring();
  }

  Future<void> _restore() async {
    final generation = _authGeneration;
    try {
      final stored = await _readPersisted();
      if (generation != _authGeneration) return;
      if (stored == null) {
        state = const SessionSignedOut();
        return;
      }
      final client = ref.read(apiClientProvider);
      client.accessToken = stored.accessToken;
      client.onUnauthorized = _rotateOn401;
      state = SessionSignedIn(stored.user, stored);
    } catch (_) {
      if (generation != _authGeneration) return;
      await _clear(onlyIfGeneration: generation);
      if (generation == _authGeneration) {
        state = const SessionSignedOut();
      }
    }
  }

  Future<void> sendOtp({String? phone, String? email}) async {
    if (_loggingOut) return;
    final channel = phone != null ? OtpChannel.sms : OtpChannel.email;
    final identifier = phone ?? email!;
    final previous = state;
    if (previous is SessionSendingOtp &&
        previous.channel == channel &&
        previous.identifier == identifier) {
      return; // Double tap must never dispatch a duplicate OTP.
    }
    final generation = ++_authGeneration;
    state = SessionSendingOtp(channel, identifier);
    try {
      final res =
          await ref.read(apiClientProvider).otpSend(phone: phone, email: email);
      if (generation != _authGeneration) return;
      state =
          SessionAwaitingOtp(res.channel, res.identifier, res.resendInSeconds);
    } catch (e) {
      if (generation != _authGeneration) return;
      final err = e is ApiException
          ? e
          : const ApiException('Could not send verification code');
      state = SessionError(
        err.message,
        code: err.code,
        channel: channel,
        identifier: identifier,
      );
    }
  }

  Future<void> verifyOtp(
    String code, {
    String? phone,
    String? email,
    String? name,
  }) async {
    if (_loggingOut) return;
    // Auto-submit of the sixth digit and the Verify button can fire together.
    // Rechecking the UI is not sufficient: the domain must enforce one flight.
    if (state is SessionVerifying) return;
    final channel = phone != null ? OtpChannel.sms : OtpChannel.email;
    final identifier = phone ?? email!;
    final generation = ++_authGeneration;
    state = SessionVerifying(channel, identifier);
    try {
      final tokens = await ref.read(apiClientProvider).otpVerify(
            code,
            phone: phone,
            email: email,
            name: name,
          );
      if (generation != _authGeneration) return;
      if (!await _persist(tokens, generation)) return;
      if (generation != _authGeneration) return;
      state = SessionSignedIn(tokens.user, tokens);
    } catch (e) {
      if (generation != _authGeneration) return;
      final err =
          e is ApiException ? e : const ApiException('Could not verify code');
      if (err.code == 'NAME_REQUIRED_ON_SIGNUP') {
        state = SessionNameRequired(channel, identifier, code);
        return;
      }
      if (name != null &&
          err.code != 'OTP_INVALID' &&
          err.code != 'OTP_LOCKED') {
        state = SessionNameRequired(
          channel,
          identifier,
          code,
          message: err.message,
        );
        return;
      }
      state = SessionError(
        err.message,
        code: err.code,
        channel: channel,
        identifier: identifier,
      );
    }
  }

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
    if (_loggingOut) return;
    final generation = ++_authGeneration;
    final stored = await _readPersisted();
    if (generation != _authGeneration) return;
    if (stored == null) {
      await _clear(onlyIfGeneration: generation);
      if (generation == _authGeneration) state = const SessionSignedOut();
      return;
    }
    try {
      final rotated =
          await ref.read(apiClientProvider).refresh(stored.refreshToken);
      if (generation != _authGeneration) return;
      if (!await _persist(rotated, generation)) return;
      if (generation == _authGeneration) {
        state = SessionSignedIn(rotated.user, rotated);
      }
    } catch (_) {
      if (generation != _authGeneration) return;
      await _clear(onlyIfGeneration: generation);
      if (generation == _authGeneration) state = const SessionSignedOut();
    }
  }

  Future<String?> _rotateOn401() async {
    await refresh();
    if (state is SessionSignedIn) {
      return (state as SessionSignedIn).tokens.accessToken;
    }
    return null;
  }

  Future<void> logout() async {
    if (_loggingOut) return;
    _loggingOut = true;
    // Invalidate old verify/refresh/migration completions first.
    final generation = ++_authGeneration;
    final client = ref.read(apiClientProvider);
    // Logout 401 must never trigger a refresh of the token being revoked.
    client.onUnauthorized = null;
    try {
      // Preserve the existing bearer until the logout request is dispatched.
      // New OTP/refresh operations are fenced while logout is in progress.
      try {
        await client.logout();
      } catch (_) {
        // Offline logout still clears local credentials.
      }
      await _clear();
      if (generation == _authGeneration) {
        state = const SessionSignedOut();
      }
    } finally {
      _loggingOut = false;
    }
  }

  Future<bool> _persist(AuthTokens tokens, int generation) =>
      _withCredentialLock(() async {
        if (generation != _authGeneration) return false;
        // A single encrypted record replaces four sequential keystore writes.
        await _storage.write(
          key: _kSession,
          value: jsonEncode({
            'accessToken': tokens.accessToken,
            'refreshToken': tokens.refreshToken,
            'accessExpiresIn': tokens.accessExpiresIn,
            'user': tokens.user.toJson(),
          }),
        );
        if (generation != _authGeneration) return false;
        final client = ref.read(apiClientProvider);
        client.accessToken = tokens.accessToken;
        client.onUnauthorized = _rotateOn401;
        return true;
      });

  AuthTokens? _decodeSessionBlob(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final value = jsonDecode(raw);
      if (value is! Map<String, dynamic>) return null;
      final access = value['accessToken'];
      final refresh = value['refreshToken'];
      final expiry = value['accessExpiresIn'];
      final userRaw = value['user'];
      if (access is! String ||
          access.isEmpty ||
          refresh is! String ||
          refresh.isEmpty ||
          userRaw is! Map<String, dynamic>) {
        return null;
      }
      return AuthTokens(
        accessToken: access,
        refreshToken: refresh,
        accessExpiresIn: expiry is int ? expiry : 900,
        user: AuthUser.fromJson(userRaw),
      );
    } catch (_) {
      return null;
    }
  }

  Future<AuthTokens?> _readPersisted() async {
    final readGeneration = _authGeneration;
    // Fast path: current installs require one encrypted read.
    final current = _decodeSessionBlob(await _storage.read(key: _kSession));
    if (current != null) return current;

    // Backward-compatible migration for APKs that stored four independent keys.
    // One bulk platform call is cheaper than four additional secure-storage
    // calls on a fresh install while still preserving legacy upgrades.
    final legacy = await _storage.readAll();
    final access = legacy[_kAccess];
    final refresh = legacy[_kRefresh];
    final userRaw = legacy[_kUser];
    final expiryRaw = legacy[_kExpiry];
    if (access == null || refresh == null || userRaw == null) return null;
    if (access.isEmpty || refresh.isEmpty) return null;

    try {
      final tokens = AuthTokens(
        accessToken: access,
        refreshToken: refresh,
        accessExpiresIn: int.tryParse(expiryRaw ?? '') ?? 900,
        user: AuthUser.fromJson(
          jsonDecode(userRaw) as Map<String, dynamic>,
        ),
      );

      // Migration must never delay first paint, but its write is ordered
      // with logout deletion and ignored if this restore was superseded.
      unawaited(
        _withCredentialLock(() async {
          if (readGeneration != _authGeneration) return;
          await _storage.write(
            key: _kSession,
            value: jsonEncode({
              'accessToken': tokens.accessToken,
              'refreshToken': tokens.refreshToken,
              'accessExpiresIn': tokens.accessExpiresIn,
              'user': tokens.user.toJson(),
            }),
          );
        }).catchError((_) {}),
      );
      return tokens;
    } catch (_) {
      return null;
    }
  }

  Future<void> _clear({int? onlyIfGeneration}) =>
      _withCredentialLock(() async {
        if (onlyIfGeneration != null &&
            onlyIfGeneration != _authGeneration) {
          return;
        }
        final client = ref.read(apiClientProvider);
        client.accessToken = null;
        client.onUnauthorized = null;
        await Future.wait<void>([
          _storage.delete(key: _kSession),
          _storage.delete(key: _kAccess),
          _storage.delete(key: _kRefresh),
          _storage.delete(key: _kExpiry),
          _storage.delete(key: _kUser),
        ]);
      });
}

final sessionProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

final isSignedInProvider = Provider<bool>((ref) {
  return ref.watch(sessionProvider) is SessionSignedIn;
});

