import 'package:masanawa/src/agents/agent_directory.dart';
import 'package:masanawa/src/agents/agent_directory_cache.dart';
import 'package:masanawa/src/state/agent_directory_state.dart';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/core/network/api_client.dart';
import 'package:masanawa/src/core/api/models.dart';
import 'package:masanawa/src/core/providers.dart';
import 'package:masanawa/src/home/home_models.dart';
import 'package:masanawa/src/home/home_state.dart';
import 'package:masanawa/src/state/my_twin_state.dart';
import 'package:masanawa/src/state/session_state.dart';
import 'package:masanawa/src/state/twin_activity_state.dart';
import 'package:masanawa/src/state/twin_directory_state.dart';
import 'package:masanawa/src/state/wallet_state.dart';

const _user = AuthUser(
  id: 'test-owner',
  name: 'Test Owner',
  email: 'owner@example.test',
  locale: 'en-NG',
  status: 'ACTIVE',
  role: 'USER',
  isNewUser: false,
  createdAt: '2026-10-07T00:00:00Z',
);
const _tokens = AuthTokens(
  accessToken: 'test-access',
  refreshToken: 'test-refresh',
  accessExpiresIn: 900,
  user: _user,
);

class _Session extends SessionController {
  @override
  SessionState build() => const SessionSignedIn(_user, _tokens);
}

class _Adapter implements HttpClientAdapter {
  _Adapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) => handler(options);

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

class _TestDirectoryCache implements AgentDirectoryCache {
  @override
  Future<List<AgentDirectoryEntry>?> read(String owner) async => null;
  @override
  Future<void> write(String owner, List<AgentDirectoryEntry> agents) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'production Twin state providers use the authenticated Gateway transports',
    () async {
      final seenPaths = <String>[];
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
      dio.httpClientAdapter = _Adapter((options) async {
        expect(options.headers['Authorization'], 'Bearer test-access');
        seenPaths.add(options.path);
        switch (options.path) {
          case 'https://masanawa-gateway-production.up.railway.app/agent/directory':
            return _json({'agents': []});
          case '/home':
            return _json({
              'assistants': [
                {
                  'role': 'gwana',
                  'characterId': 'character-gwana',
                  'displayName': 'Gwana',
                  'description': 'Platform assistant',
                  'voiceLabel': 'Sulafat',
                  'avatarUrl': null,
                  'isAvailable': true,
                },
                {
                  'role': 'gwani',
                  'characterId': 'character-gwani',
                  'displayName': 'Gwani',
                  'description': 'Platform assistant',
                  'voiceLabel': 'Bodi',
                  'avatarUrl': null,
                  'isAvailable': true,
                },
              ],
              'rooms': [
                {
                  'roomId': 'room.internet-cafe',
                  'title': 'Internet Cafe',
                  'description': 'Digital services',
                  'iconKey': 'internet_cafe',
                  'continuationLabel': null,
                  'isAvailable': true,
                },
              ],
              'continuations': [],
            });
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
          case '/v1/wallet/ngn':
            return _json({'balanceKobo': 12300, 'balance': '₦123.00'});
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
          dioProvider.overrideWithValue(dio),
          apiClientProvider.overrideWithValue(
            ApiClient(dio: dio)..accessToken = 'test-access',
          ),
          sessionProvider.overrideWith(_Session.new),
          isSignedInProvider.overrideWithValue(true),
          agentDirectoryCacheProvider.overrideWithValue(_TestDirectoryCache()),
        ],
      );
      addTearDown(container.dispose);

      final mine = await container.read(myTwinProvider.future);
      expect(mine?.displayName, 'Amina Bello');
      expect(mine?.publicUrl, 'https://masanawa.com/amina-bello');

      await container.read(agentDirectoryProvider.notifier).refresh();
      await Future<void>.delayed(Duration.zero);
      final home = await container.read(homeProvider.future);
      expect(
        home.assistantFor(HomeAssistantRole.gwana)?.characterId,
        'character-gwana',
      );
      expect(
        home.assistantFor(HomeAssistantRole.gwani)?.characterId,
        'character-gwani',
      );
      expect(home.rooms.single.roomId, 'room.internet-cafe');
      expect(home.myTwin?.characterId, 'character-owner');

      final directory = container.read(twinDirectoryProvider.notifier);
      await directory.loadInitial();
      expect(
        container.read(twinDirectoryProvider).items.single.publicId,
        'amina-bello',
      );

      final activity = await container.read(twinActivityProvider.future);
      expect(activity?.summary.earningsCredits, 25);

      final wallet = await container.read(walletProvider.future);
      expect(wallet?.spendableCredits, 1200);
      expect(wallet?.ngnBalanceKobo, 12300);
      expect(wallet?.availableEarningsCredits, 70);

      expect(
        seenPaths,
        containsAll(<String>[
          '/home',
          '/v1/my-twin',
          '/agent/twins',
          '/agent/twin/activity',
          '/v1/wallet',
        ]),
      );
    },
  );
}

