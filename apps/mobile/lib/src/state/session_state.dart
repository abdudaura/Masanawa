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
      client.onUnauthorized = _rotateOn401;
      state = SessionSignedIn(stored.user, stored);
    } catch (_) {
      await _clear();
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
      state =
          SessionAwaitingOtp(res.channel, res.identifier, res.resendInSeconds);
    } catch (e) {
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
    final channel = phone != null ? OtpChannel.sms : OtpChannel.email;
    final identifier = phone ?? email!;
    state = SessionVerifying(channel, identifier);
    try {
      final tokens = await ref.read(apiClientProvider).otpVerify(
            code,
            phone: phone,
            email: email,
            name: name,
          );
      await _persist(tokens);
      state = SessionSignedIn(tokens.user, tokens);
    } catch (e) {
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
    final stored = await _readPersisted();
    if (stored == null) {
      await _clear();
      state = const SessionSignedOut();
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

  Future<String?> _rotateOn401() async {
    await refresh();
    if (state is SessionSignedIn) {
      return (state as SessionSignedIn).tokens.accessToken;
    }
    return null;
  }

  Future<void> logout() async {
    try {
      await ref.read(apiClientProvider).logout();
    } catch (_) {
      // Sign-out is always completed locally even if the network is unavailable.
    }
    await _clear();
    state = const SessionSignedOut();
  }

  Future<void> _persist(AuthTokens tokens) async {
    final client = ref.read(apiClientProvider);
    client.accessToken = tokens.accessToken;
    client.onUnauthorized = _rotateOn401;

    // One encrypted record replaces four sequential keystore writes/reads on
    // normal startup. Legacy keys remain readable for seamless upgrades.
    await _storage.write(
      key: _kSession,
      value: jsonEncode({
        'accessToken': tokens.accessToken,
        'refreshToken': tokens.refreshToken,
        'accessExpiresIn': tokens.accessExpiresIn,
        'user': tokens.user.toJson(),
      }),
    );
  }

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

      // Migration must never delay the first useful screen.
      unawaited(
        _storage
            .write(
              key: _kSession,
              value: jsonEncode({
                'accessToken': tokens.accessToken,
                'refreshToken': tokens.refreshToken,
                'accessExpiresIn': tokens.accessExpiresIn,
                'user': tokens.user.toJson(),
              }),
            )
            .catchError((_) {}),
      );
      return tokens;
    } catch (_) {
      return null;
    }
  }

  Future<void> _clear() async {
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
  }
}

final sessionProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

final isSignedInProvider = Provider<bool>((ref) {
  return ref.watch(sessionProvider) is SessionSignedIn;
});
