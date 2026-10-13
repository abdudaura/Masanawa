import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/rooms/room_membership_client.dart';

class TestMembership implements RoomMembershipClient {
  final pending = Completer<void>();
  @override Future<void> accept(String id, String token) => pending.future;
  @override Future<List<RoomMember>> members(String id) async => [];
  @override Future<List<RoomInvite>> invites(String id) async => [];
  @override Future<String> issue(String id) async => 'a' * 43;
  @override Future<void> revoke(String id, String invite) async {}
  @override Future<void> moderate(String id, String user, String action) async {}
}

void main() {
  test('invite token is posted in private body, never in request URL', () async {
    final requests = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test.invalid'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      requests.add(options);
      handler.resolve(Response(requestOptions: options, data: {'joined': true}));
    }));
    final token = 'a' * 43;
    final client = HttpRoomMembershipClient(dio);
    await client.accept('room_math', token);
    expect(requests, hasLength(1));
    expect(requests.single.path, '/v1/rooms/room_math/invites/accept');
    expect(requests.single.method, 'POST');
    expect(requests.single.data, {'token': token});
    expect(requests.single.path, isNot(contains(token)));
    expect(requests.single.headers['Cache-Control'], 'no-store');
    await expectLater(client.accept('room_math', 'bad'),
        throwsA(isA<FormatException>()));
    expect(requests, hasLength(1));
  });

  test('malformed server lists fail closed instead of looking empty', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test.invalid'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) =>
        handler.resolve(Response(requestOptions: options, data: {'wrong': []}))));
    await expectLater(HttpRoomMembershipClient(dio).invites('room_math'),
        throwsA(isA<FormatException>()));
  });

  test('account switch fences inflight invitation redemption', () async {
    final fake = TestMembership();
    var active = 'fan-one';
    final client = AccountBoundRoomMembershipClient(
        delegate: fake, ownerAccount: 'fan-one', currentAccount: () => active);
    final inFlight = client.accept('room_math', 'a' * 43);
    active = 'fan-two';
    fake.pending.complete();
    await expectLater(inFlight, throwsA(isA<StateError>()));
    await expectLater(client.issue('room_math'), throwsA(isA<StateError>()));
  });

  test('membership write is not redirected on invalid actions', () async {
    final calls = <RequestOptions>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://gateway.test.invalid'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      calls.add(options);
      handler.resolve(Response(requestOptions: options, data: {'updated': true}));
    }));
    final client = HttpRoomMembershipClient(dio);
    await client.moderate('room_math', 'fan-2', 'ban');
    expect(calls.single.path, '/v1/rooms/room_math/members/fan-2/moderate');
    expect(calls.single.data, {'action': 'ban'});
    await expectLater(client.moderate('room_math', 'fan-2', 'promote'),
        throwsA(isA<FormatException>()));
    expect(calls, hasLength(1));
  });
}
