import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/session_state.dart';

/// Session state machine tests (U-p2-01/03 mobile mirror). The Dio adapter is
/// mocked so no network leaves the test; the contract envelope shapes come
/// straight from packages/contracts.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ApiClient api;
  late _FakeAdapter adapter;
  final storageMap = <String, String>{};
  final storageReads = <String>[];
  var storageReadAlls = 0;

  ProviderContainer makeContainer() {
    final container = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(api),
    ]);
    addTearDown(container.dispose);
    return container;
  }

  setUp(() {
    adapter = _FakeAdapter();
    storageMap.clear();
    storageReads.clear();
    storageReadAlls = 0;
    final dio = Dio(BaseOptions(
      baseUrl: 'https://example.test',
      validateStatus: (s) => s != null && s >= 200 && s < 300,
    ));
    dio.httpClientAdapter = adapter;
    api = ApiClient(dio: dio);

    // The session controller restores a persisted session from
    // flutter_secure_storage on first read. A plain test env has no plugin
    // channel, so stub the channel against an in-memory map.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async {
        switch (call.method) {
          case 'read':
            final key = call.arguments['key'] as String;
            storageReads.add(key);
            return storageMap[key];
          case 'readAll':
            storageReadAlls += 1;
            return Map<String, String>.from(storageMap);
          case 'write':
            storageMap[call.arguments['key'] as String] =
                call.arguments['value'] as String;
            return true;
          case 'delete':
            storageMap.remove(call.arguments['key'] as String);
            return true;
          case 'containsKey':
            return storageMap.containsKey(call.arguments['key'] as String);
          default:
            return null;
        }
      },
    );
  });

  const phone = '+2348012345678';
  const email = 'ada@example.com';
  const code = '123456';
  const user = AuthUser(
    id: 'usr_test',
    name: 'Ada Obi',
    phone: '+2348012345678',
    locale: 'en-NG',
    status: 'ACTIVE',
    role: 'USER',
    isNewUser: false,
    createdAt: '2026-08-13T00:00:00Z',
  );

  test('auth capabilities expose only server-configured OTP channels', () async {
    adapter.respond('/auth/capabilities', {
      'otpChannels': ['email'],
    });

    final channels = await api.authOtpChannels();

    expect(channels, [OtpChannel.email]);
    expect(adapter.requests.last, 'GET /auth/capabilities');
  });

  test('auth capabilities reject an invalid contract shape', () async {
    adapter.respond('/auth/capabilities', {
      'otpChannels': 'email',
    });

    await expectLater(
      api.authOtpChannels(),
      throwsA(isA<ApiException>()),
    );
  });

  test('current persisted session restores with one secure-storage read', () async {
    storageMap['auth_session_v2'] = jsonEncode({
      'accessToken': 'fast-access',
      'refreshToken': 'fast-refresh',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    final container = makeContainer();

    container.read(sessionProvider);
    await Future<void>.delayed(Duration.zero);

    final restored = container.read(sessionProvider);
    expect(restored, isA<SessionSignedIn>());
    expect(api.accessToken, 'fast-access');
    expect(storageReads, ['auth_session_v2']);
    expect(storageReadAlls, 0);
  });

  test('legacy session restores through one bulk fallback and migrates', () async {
    storageMap['auth_access_token'] = 'legacy-access';
    storageMap['auth_refresh_token'] = 'legacy-refresh';
    storageMap['auth_access_expires_in'] = '900';
    storageMap['auth_user'] = jsonEncode(user.toJson());
    final container = makeContainer();

    container.read(sessionProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    final restored = container.read(sessionProvider);
    expect(restored, isA<SessionSignedIn>());
    expect(api.accessToken, 'legacy-access');
    expect(storageReads, ['auth_session_v2']);
    expect(storageReadAlls, 1);
    expect(storageMap['auth_session_v2'], isNotNull);
  });

  test('fresh signed-out install uses one current read and one bulk fallback', () async {
    final container = makeContainer();

    container.read(sessionProvider);
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    expect(container.read(sessionProvider), isA<SessionSignedOut>());
    expect(storageReads, ['auth_session_v2']);
    expect(storageReadAlls, 1);
  });

  test('sendOtp (phone) transitions signedOut → sending → awaitingOtp', () async {
    adapter.respond('/auth/otp', {'phone': phone, 'resendInSeconds': 300});
    final container = makeContainer();

    final controller = container.read(sessionProvider.notifier);
    await Future.delayed(Duration.zero);
    expect(container.read(sessionProvider), isA<SessionSignedOut>());

    final f = controller.sendOtp(phone: phone);
    expect(container.read(sessionProvider), isA<SessionSendingOtp>());
    await f;

    final state = container.read(sessionProvider);
    if (state is SessionError) {
      fail('Unexpected SessionError: ${state.message} code=${state.code}');
    }
    expect(state, isA<SessionAwaitingOtp>());
    final awaiting = state as SessionAwaitingOtp;
    expect(awaiting.channel, OtpChannel.sms);
    expect(awaiting.identifier, phone);
    expect(awaiting.resendInSeconds, 300);
  });

  test('sendOtp (email) carries the email channel + identifier', () async {
    adapter.respond('/auth/otp', {'email': email, 'resendInSeconds': 300});
    final container = makeContainer();

    final controller = container.read(sessionProvider.notifier);
    await Future.delayed(Duration.zero);
    final f = controller.sendOtp(email: email);
    expect(container.read(sessionProvider), isA<SessionSendingOtp>());
    await f;

    final state = container.read(sessionProvider);
    expect(state, isA<SessionAwaitingOtp>());
    final awaiting = state as SessionAwaitingOtp;
    expect(awaiting.channel, OtpChannel.email);
    expect(awaiting.identifier, email);
  });

  test('verifyOtp transitions to signedIn and persists the production session', () async {
    adapter.respond('/auth/verify', {
      'accessToken': 'a1',
      'refreshToken': 'r1',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    final container = makeContainer();

    final controller = container.read(sessionProvider.notifier);
    await Future.delayed(Duration.zero);
    await controller.verifyOtp(code, phone: phone);

    final state = container.read(sessionProvider);
    expect(state, isA<SessionSignedIn>());
    final signedIn = state as SessionSignedIn;
    expect(signedIn.user.name, 'Ada Obi');
    expect(api.accessToken, 'a1');

    // The complete session is persisted as one encrypted record so returning
    // users avoid four independent keystore reads.
    final storedSession =
        await const FlutterSecureStorage().read(key: 'auth_session_v2');
    expect(storedSession, isNotNull);
    final persisted = jsonDecode(storedSession!) as Map<String, dynamic>;
    expect(persisted['accessToken'], 'a1');
    expect(persisted['refreshToken'], 'r1');
  });

  test('verifyOtp (email) verifies the email channel', () async {
    adapter.respond('/auth/verify', {
      'accessToken': 'a2',
      'refreshToken': 'r2',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    final container = makeContainer();

    final controller = container.read(sessionProvider.notifier);
    await Future.delayed(Duration.zero);
    await controller.verifyOtp(code, email: email);

    expect(container.read(sessionProvider), isA<SessionSignedIn>());
  });

  test('new signup keeps the verified OTP for required name capture', () async {
    adapter.respond(
      '/auth/verify',
      {
        'error': {
          'code': 'NAME_REQUIRED_ON_SIGNUP',
          'message': 'NAME_REQUIRED_ON_SIGNUP',
        }
      },
      statusCode: 400,
    );
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future.delayed(Duration.zero);

    await controller.verifyOtp(code, email: email);

    final pending = container.read(sessionProvider);
    expect(pending, isA<SessionNameRequired>());
    final nameRequired = pending as SessionNameRequired;
    expect(nameRequired.channel, OtpChannel.email);
    expect(nameRequired.identifier, email);
    expect(nameRequired.code, code);

    final completed = AuthUser(
      id: 'user_test',
      name: 'Ada Obi',
      email: email,
      locale: 'en-NG',
      status: 'ACTIVE',
      role: 'CITIZEN',
      isNewUser: false,
      createdAt: '2026-10-05T00:00:00Z',
    );
    adapter.respond('/auth/verify', {
      'accessToken': 'a3',
      'refreshToken': 'r3',
      'accessExpiresIn': 900,
      'user': completed.toJson(),
    });

    await controller.verifyOtp(
      nameRequired.code,
      email: nameRequired.identifier,
      name: 'Ada Obi',
    );

    final signedIn = container.read(sessionProvider);
    expect(signedIn, isA<SessionSignedIn>());
    final completedState = signedIn as SessionSignedIn;
    expect(completedState.user.name, 'Ada Obi');
    expect(completedState.user.isNewUser, isFalse);
    expect(api.accessToken, 'a3');
  });

  test('email profile completion keeps the verified email despite added phone', () async {
    adapter.respond('/auth/verify', {'code': 'NAME_REQUIRED_ON_SIGNUP'}, statusCode: 400);
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    await controller.verifyOtp(code, email: email);
    adapter.respond('/auth/verify', {'code': 'AUTH_UNAVAILABLE'}, statusCode: 503);
    await controller.submitProfile(name: 'Ada Obi', phone: phone);
    expect(adapter.bodies.last, {'email': email, 'code': code, 'name': 'Ada Obi'});
    final pending = container.read(sessionProvider) as SessionNameRequired;
    expect(pending.channel, OtpChannel.email);
    expect(pending.identifier, email);
    adapter.respond('/auth/verify', {
      'accessToken': 'new-access', 'refreshToken': 'new-refresh',
      'accessExpiresIn': 900, 'user': user.toJson(),
    });
    await controller.submitProfile(name: 'Ada Obi');
    expect(adapter.bodies.last, {'email': email, 'code': code, 'name': 'Ada Obi'});
    expect(container.read(sessionProvider), isA<SessionSignedIn>());
  });

  test('temporary failure during name capture preserves the verified OTP',
      () async {
    adapter.respond(
      '/auth/verify',
      {
        'error': {
          'code': 'NAME_REQUIRED_ON_SIGNUP',
          'message': 'NAME_REQUIRED_ON_SIGNUP',
        }
      },
      statusCode: 400,
    );
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future.delayed(Duration.zero);
    await controller.verifyOtp(code, email: email);
    final initial = container.read(sessionProvider) as SessionNameRequired;

    adapter.respond(
      '/auth/verify',
      {
        'error': {'code': 'AUTH_UNAVAILABLE', 'message': 'temporary'}
      },
      statusCode: 503,
    );
    await controller.verifyOtp(
      initial.code,
      email: initial.identifier,
      name: 'Ada Obi',
    );

    final retry = container.read(sessionProvider);
    expect(retry, isA<SessionNameRequired>());
    final preserved = retry as SessionNameRequired;
    expect(preserved.code, code);
    expect(preserved.identifier, email);
    expect(preserved.message, isNotEmpty);
  });

  test('network failure on sendOtp lands in SessionError', () async {
    adapter.respond(
      '/auth/otp',
      {
        'error': {'code': 'OTP_RATE_LIMITED', 'message': 'Too many attempts.'}
      },
      statusCode: 429,
    );
    final container = makeContainer();

    await container.read(sessionProvider.notifier).sendOtp(phone: phone);

    final state = container.read(sessionProvider);
    expect(state, isA<SessionError>());
    expect((state as SessionError).code, 'OTP_RATE_LIMITED');
  });

  test('verifyOtp failure keeps the retry context (channel + identifier) in SessionError',
      () async {
    adapter.respond(
      '/auth/verify',
      {
        'error': {'code': 'OTP_INVALID', 'message': 'Invalid or expired code.'}
      },
      statusCode: 401,
    );
    final container = makeContainer();

    await container.read(sessionProvider.notifier).verifyOtp('000000', email: email);

    final state = container.read(sessionProvider);
    expect(state, isA<SessionError>());
    final err = state as SessionError;
    expect(err.code, 'OTP_INVALID');
    // The OTP screen rebuilds its retry/resend actions from these.
    expect(err.channel, OtpChannel.email);
    expect(err.identifier, email);
  });

  test('delayed old-account refresh cannot overwrite next login or keystore', () async {
    storageMap['auth_session_v2'] = jsonEncode({
      'accessToken': 'a1',
      'refreshToken': 'ar1',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(sessionProvider), isA<SessionSignedIn>());

    adapter.defer('/auth/refresh');
    final oldRefresh = controller.refresh();
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);

    final nextUser = AuthUser(
      id: 'fan-b',
      name: 'Fan B',
      locale: 'en',
      status: 'ACTIVE',
      role: 'USER',
      isNewUser: false,
      createdAt: '2026-10-13T00:00:00Z',
    );
    adapter.respond('/auth/verify', {
      'accessToken': 'b1',
      'refreshToken': 'br1',
      'accessExpiresIn': 900,
      'user': nextUser.toJson(),
    });
    await controller.verifyOtp(code, email: email);
    expect((container.read(sessionProvider) as SessionSignedIn).user.id, 'fan-b');
    adapter.completeDeferred('/auth/refresh', {
      'accessToken': 'a2',
      'refreshToken': 'ar2',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    await oldRefresh;
    final state = container.read(sessionProvider) as SessionSignedIn;
    expect(state.user.id, 'fan-b');
    expect(api.accessToken, 'b1');
    expect(jsonDecode(storageMap['auth_session_v2']!)['accessToken'], 'b1');
  });

  test('logout fences deferred refresh from reviving signed-out session', () async {
    storageMap['auth_session_v2'] = jsonEncode({
      'accessToken': 'a1',
      'refreshToken': 'ar1',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    adapter.defer('/auth/refresh');
    final stale = controller.refresh();
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    await controller.logout();
    adapter.completeDeferred('/auth/refresh', {
      'accessToken': 'a2',
      'refreshToken': 'ar2',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    await stale;
    expect(container.read(sessionProvider), isA<SessionSignedOut>());
    expect(storageMap.containsKey('auth_session_v2'), isFalse);
    expect(api.accessToken, isNull);
  });

  test('clearVerifyError returns to awaitingOtp with the live cooldown', () async {
    adapter.respond(
      '/auth/verify',
      {
        'error': {'code': 'OTP_INVALID', 'message': 'Invalid or expired code.'}
      },
      statusCode: 401,
    );
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future.delayed(Duration.zero);

    await controller.verifyOtp('000000', phone: phone);
    expect(container.read(sessionProvider), isA<SessionError>());

    // Editing the code after a wrong attempt clears the error and restores the
    // countdown value the screen holds, so resend stays correctly gated.
    controller.clearVerifyError(channel: OtpChannel.sms, identifier: phone, resendInSeconds: 41);

    final state = container.read(sessionProvider);
    expect(state, isA<SessionAwaitingOtp>());
    final awaiting = state as SessionAwaitingOtp;
    expect(awaiting.channel, OtpChannel.sms);
    expect(awaiting.identifier, phone);
    expect(awaiting.resendInSeconds, 41);
  });
}

/// Minimal Dio adapter: records requests and replays canned contract-shaped
/// responses. Dio's MockAdapter needs a package dep; this keeps the test lean.
class _FakeAdapter implements HttpClientAdapter {
  final _requests = <String>[];
  final bodies = <dynamic>[];
  final _deferred = <String, Completer<ResponseBody>>{};

  void defer(String path) {
    _deferred[path] = Completer<ResponseBody>();
  }

  void completeDeferred(String path, Map<String, dynamic> body,
      {int statusCode = 200}) {
    _deferred[path]!.complete(ResponseBody.fromString(
      jsonEncode(body), statusCode,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    ));
  }
  _Route _next = _Route(
    path: '/',
    statusCode: 200,
    body: const {},
  );

  void respond(String path, Map<String, dynamic> body, {int statusCode = 200}) {
    _next = _Route(path: path, statusCode: statusCode, body: body);
  }

  List<String> get requests => List.unmodifiable(_requests);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    _requests.add('${options.method} ${options.path}');
    bodies.add(options.data);
    final pending = _deferred[options.path];
    if (pending != null) return pending.future;
    final route = _next;
    final body = jsonEncode(route.body);
    return ResponseBody.fromString(
      body,
      route.statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _Route {
  const _Route({required this.path, required this.statusCode, required this.body});
  final String path;
  final int statusCode;
  final Map<String, dynamic> body;
}
