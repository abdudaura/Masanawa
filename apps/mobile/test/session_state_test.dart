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
  Completer<void>? sessionWriteGate;
  Completer<void>? sessionWriteStarted;

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
    sessionWriteGate = null;
    sessionWriteStarted = null;
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
            final key = call.arguments['key'] as String;
            if (key == 'auth_session_v2' && sessionWriteGate != null) {
              final gate = sessionWriteGate!;
              sessionWriteGate = null;
              sessionWriteStarted?.complete();
              await gate.future;
            }
            storageMap[key] = call.arguments['value'] as String;
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
  test('auto-submit and Verify tap produce exactly one OTP verification',
      () async {
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    adapter.holdVerify();

    final first = controller.verifyOtp(code, email: email);
    final second = controller.verifyOtp(code, email: email);
    await adapter.verifyStarted!.future;
    expect(adapter.requests.where((r) => r == 'POST /auth/verify'), hasLength(1));
    adapter.completeVerify({
      'accessToken': 'single',
      'refreshToken': 'single-refresh',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    await Future.wait([first, second]);
    expect(container.read(sessionProvider), isA<SessionSignedIn>());
    expect(storageMap['auth_session_v2'], isNotNull);
  });

  test('logout fences a late OTP response and deletes secure credentials',
      () async {
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    adapter.holdVerify();
    final verifying = controller.verifyOtp(code, email: email);
    await controller.logout();

    adapter.completeVerify({
      'accessToken': 'too-late',
      'refreshToken': 'never-store-me',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    await verifying;
    expect(container.read(sessionProvider), isA<SessionSignedOut>());
    expect(storageMap.containsKey('auth_session_v2'), isFalse);
    expect(api.accessToken, isNull);
  });

  test('resend or identity change fences stale invalid OTP result', () async {
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    adapter.holdVerify();
    final old = controller.verifyOtp(code, email: email);
    adapter.respond('/auth/otp', {'email': 'another@example.com', 'resendInSeconds': 45});
    await controller.sendOtp(email: 'another@example.com');
    final awaiting = container.read(sessionProvider) as SessionAwaitingOtp;
    expect(awaiting.identifier, 'another@example.com');

    adapter.completeVerify({
      'error': {'code': 'OTP_INVALID', 'message': 'Old code was wrong'}
    }, statusCode: 401);
    await old;
    final now = container.read(sessionProvider) as SessionAwaitingOtp;
    expect(now.identifier, 'another@example.com');
    expect(now.resendInSeconds, 45);
  });

  test('duplicate send while sending same OTP context has one network call',
      () async {
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    adapter.holdSend();
    final first = controller.sendOtp(phone: phone);
    final duplicate = controller.sendOtp(phone: phone);
    await adapter.sendStarted!.future;
    expect(adapter.requests.where((r) => r == 'POST /auth/otp'), hasLength(1));
    adapter.completeSend({'phone': phone, 'resendInSeconds': 60});
    await Future.wait([first, duplicate]);
    expect(container.read(sessionProvider), isA<SessionAwaitingOtp>());
  });

  test('logout authorization failure does not start a token refresh', () async {
    storageMap['auth_session_v2'] = jsonEncode({
      'accessToken': 'test-access',
      'refreshToken': 'test-refresh',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    final container = makeContainer();
    container.read(sessionProvider);
    await Future<void>.delayed(Duration.zero);
    expect(container.read(sessionProvider), isA<SessionSignedIn>());
    adapter.respond('/auth/logout', {
      'error': {'code': 'UNAUTHORIZED', 'message': 'expired'}
    }, statusCode: 401);
    await container.read(sessionProvider.notifier).logout();
    expect(adapter.requests.where((r) => r == 'POST /auth/refresh'),
        isEmpty);
    expect(container.read(sessionProvider), isA<SessionSignedOut>());
    expect(storageMap.containsKey('auth_session_v2'), isFalse);
    expect(api.onUnauthorized, isNull);
  });

  test('logout queues behind already-started encrypted verify write',
      () async {
    final container = makeContainer();
    final controller = container.read(sessionProvider.notifier);
    await Future<void>.delayed(Duration.zero);
    adapter.respond('/auth/verify', {
      'accessToken': 'racing',
      'refreshToken': 'racing-refresh',
      'accessExpiresIn': 900,
      'user': user.toJson(),
    });
    final pausedWrite = Completer<void>();
    sessionWriteGate = pausedWrite;
    sessionWriteStarted = Completer<void>();
    final verify = controller.verifyOtp(code, email: email);
    // Await the intercepted native write deterministically (not clock ticks).
    await sessionWriteStarted!.future;
    expect(sessionWriteGate, isNull);
    final signOut = controller.logout();
    pausedWrite.complete();
    await Future.wait([verify, signOut]);

    expect(container.read(sessionProvider), isA<SessionSignedOut>());
    expect(storageMap.containsKey('auth_session_v2'), isFalse);
    expect(api.accessToken, isNull);
  });

}

/// Minimal Dio adapter: records requests and replays canned contract-shaped
/// responses. Dio's MockAdapter needs a package dep; this keeps the test lean.
class _FakeAdapter implements HttpClientAdapter {
  final _requests = <String>[];
  Completer<ResponseBody>? _verifyGate;
  Completer<void>? verifyStarted;
  Completer<void>? sendStarted;
  Completer<ResponseBody>? _sendGate;
  _Route _next = _Route(
    path: '/',
    statusCode: 200,
    body: const {},
  );

  void respond(String path, Map<String, dynamic> body, {int statusCode = 200}) {
    _next = _Route(path: path, statusCode: statusCode, body: body);
  }


  void holdVerify() { _verifyGate = Completer<ResponseBody>(); verifyStarted = Completer<void>(); }
  void holdSend() { _sendGate = Completer<ResponseBody>(); sendStarted = Completer<void>(); }

  void completeVerify(Map<String, dynamic> body, {int statusCode = 200}) {
    final pending = _verifyGate!;
    _verifyGate = null;
    pending.complete(_response(body, statusCode));
  }

  void completeSend(Map<String, dynamic> body, {int statusCode = 200}) {
    final pending = _sendGate!;
    _sendGate = null;
    pending.complete(_response(body, statusCode));
  }

  ResponseBody _response(Map<String, dynamic> body, int statusCode) =>
      ResponseBody.fromString(
        jsonEncode(body),
        statusCode,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

  List<String> get requests => List.unmodifiable(_requests);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    _requests.add('${options.method} ${options.path}');
    if (options.path == '/auth/verify' && _verifyGate != null) {
      if (!verifyStarted!.isCompleted) verifyStarted!.complete();
      return _verifyGate!.future;
    }
    if (options.path == '/auth/otp' && _sendGate != null) {
      if (!sendStarted!.isCompleted) sendStarted!.complete();
      return _sendGate!.future;
    }
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

