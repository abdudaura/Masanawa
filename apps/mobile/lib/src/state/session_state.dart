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

  Future<void> updateProfile({required String name}) async {
    final current = state;
    if (current is! SessionSignedIn) {
      state = const SessionSignedOut();
      return;
    }
    try {
      final user = await ref.read(apiClientProvider).updateProfile(name: name);
      final tokens = AuthTokens(
        accessToken: current.tokens.accessToken,
        refreshToken: current.tokens.refreshToken,
        accessExpiresIn: current.tokens.accessExpiresIn,
        user: user,
      );
      await _persist(tokens);
      state = SessionSignedIn(user, tokens);
    } catch (e) {
      final err =
          e is ApiException ? e : const ApiException('Could not update profile');
      state = SessionError(err.message, code: err.code);
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
    if (access.isEmpty || refresh.isEmpty) return null;
    try {
      final user =
          AuthUser.fromJson(jsonDecode(userRaw) as Map<String, dynamic>);
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

final isSignedInProvider = Provider<bool>((ref) {
  return ref.watch(sessionProvider) is SessionSignedIn;
});
