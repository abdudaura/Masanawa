import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/state/my_twin_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/twin_activity_state.dart';
import 'package:masanawa/src/state/twin_directory_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) =>
      handler(options);

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object value) => ResponseBody.fromString(
      jsonEncode(value),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );

void main() {
  test('production Twin state providers use the authenticated Gateway transports',
      () async {
    final seenPaths = <String>[];
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _Adapter((options) async {
      seenPaths.add(options.path);
      switch (options.path) {
        case '/v1/my-twin':
          return _json({
            'hasTwin': true,
            'characterId': 'character-owner',
            'displayName': 'Amina Bello',
            'bio': 'Teacher and storyteller',
            'publicUrl': 'https://masanawa.com/amina-bello',
            'discoverable': true,
            'voiceEnabled': true,
            'ownerAccessEnabled': true,
            'languages': ['English', 'Hausa'],
            'summary': {
              'visitors': 4,
              'conversations': 3,
              'earningsCredits': 25,
              'pendingOwnerRequests': 1,
            },
          });
        case '/agent/twins':
          return _json([
            {
              'publicId': 'amina-bello',
              'characterId': 'character-owner',
              'displayName': 'Amina Bello',
              'headline': 'Teacher and storyteller',
              'voiceEnabled': true,
              'ownerAccessEnabled': true,
              'publicUrl': 'https://masanawa.com/amina-bello',
            },
          ]);
        case '/agent/twin/activity':
          return _json({
            'hasTwin': true,
            'characterId': 'character-owner',
            'summary': {
              'visitors': 4,
              'conversations': 3,
              'earningsCredits': 25,
              'pendingOwnerRequests': 1,
            },
            'items': [],
          });
        case '/v1/wallet':
          return _json({
            'spendableCredits': 1200,
            'pendingEarningsCredits': 30,
            'availableEarningsCredits': 70,
            'entries': [],
          });
        default:
          return ResponseBody.fromString('not found', 404);
      }
    });

    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(ApiClient(dio: dio)),
        isSignedInProvider.overrideWithValue(true),
      ],
    );
    addTearDown(container.dispose);

    final mine = await container.read(myTwinProvider.future);
    expect(mine?.displayName, 'Amina Bello');
    expect(mine?.publicUrl, 'https://masanawa.com/amina-bello');

    final directory = container.read(twinDirectoryProvider.notifier);
    await directory.loadInitial();
    expect(container.read(twinDirectoryProvider).items.single.publicId,
        'amina-bello');

    final activity = await container.read(twinActivityProvider.future);
    expect(activity?.summary.earningsCredits, 25);

    final wallet = await container.read(walletProvider.future);
    expect(wallet?.spendableCredits, 1200);
    expect(wallet?.availableEarningsCredits, 70);

    expect(
      seenPaths,
      containsAll(<String>[
        '/v1/my-twin',
        '/agent/twins',
        '/agent/twin/activity',
        '/v1/wallet',
      ]),
    );
  });
}
