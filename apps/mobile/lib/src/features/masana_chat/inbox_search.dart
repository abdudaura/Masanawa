import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/providers.dart';

/// A server-authorized C10 result, never a locally invented contact or balance.
class MasanaInboxSearchItem {
  const MasanaInboxSearchItem({
    required this.characterId,
    required this.displayName,
    required this.profession,
    required this.lastMessage,
    required this.pinned,
    required this.unreadCount,
    required this.revision,
  });

  final String characterId;
  final String displayName;
  final String profession;
  final String lastMessage;
  final bool pinned;
  final int unreadCount;
  final int revision;

  factory MasanaInboxSearchItem.fromJson(Map<String, dynamic> data) {
    final id = data['characterId'];
    final name = data['displayName'];
    final profession = data['profession'];
    final pinned = data['pinned'];
    final unread = data['unreadCount'];
    final revision = data['revision'];
    if (id is! String || !id.startsWith('character_') ||
        name is! String || name.trim().isEmpty ||
        profession is! String || pinned is! bool ||
        unread is! int || unread < 0 || revision is! int || revision < 0) {
      throw const FormatException('Invalid authorized inbox row');
    }
    return MasanaInboxSearchItem(
      characterId: id,
      displayName: name,
      profession: profession,
      lastMessage: data['lastMessage'] is String ? data['lastMessage'] as String : '',
      pinned: pinned,
      unreadCount: unread,
      revision: revision,
    );
  }

  MasanaInboxSearchItem withPin(bool isPinned, int version) =>
      MasanaInboxSearchItem(
        characterId: characterId,
        displayName: displayName,
        profession: profession,
        lastMessage: lastMessage,
        pinned: isPinned,
        unreadCount: unreadCount,
        revision: version,
      );
}

/// Injected for widget tests and pinned to the signed-in account's credential.
abstract class MasanaInboxSearchAccess {
  Future<List<MasanaInboxSearchItem>> search({
    required String bearer,
    required String query,
  });
  Future<int> setPinned({
    required String bearer,
    required String characterId,
    required bool pinned,
    required int expectedRevision,
  });
  Future<void> markRead({
    required String bearer,
    required String characterId,
  });
}

/// This deliberately does not share ApiClient's mutable refresh interceptor.
/// AF08 must qualify session rotation before such requests can be retried.
class DioMasanaInboxSearch implements MasanaInboxSearchAccess {
  DioMasanaInboxSearch(Dio authenticatedClient)
      : _dio = Dio(authenticatedClient.options.copyWith(
          baseUrl: authenticatedClient.options.baseUrl.isEmpty
              ? kApiBaseUrl
              : authenticatedClient.options.baseUrl,
        )) {
    _dio.httpClientAdapter = authenticatedClient.httpClientAdapter;
  }

  final Dio _dio;

  Options _options(String bearer) {
    if (bearer.trim().isEmpty) throw StateError('Signed-in session required');
    return Options(
      headers: {'Authorization': 'Bearer $bearer'},
      followRedirects: false,
      receiveTimeout: const Duration(seconds: 10),
    );
  }

  @override
  Future<List<MasanaInboxSearchItem>> search({
    required String bearer,
    required String query,
  }) async {
    final term = query.trim();
    if (term.isEmpty || term.length > 80) {
      throw const FormatException('Invalid search query');
    }
    final response = await _dio.get<Map<String, dynamic>>(
      '/v1/chats',
      queryParameters: {'q': term},
      options: _options(bearer),
    );
    final rows = response.data?['chats'];
    if (rows is! List || rows.length > 100) {
      throw const FormatException('Invalid authorized inbox response');
    }
    return List.unmodifiable(rows.map((row) {
      if (row is! Map) throw const FormatException('Invalid authorized inbox row');
      return MasanaInboxSearchItem.fromJson(Map<String, dynamic>.from(row));
    }));
  }

  @override
  Future<int> setPinned({
    required String bearer,
    required String characterId,
    required bool pinned,
    required int expectedRevision,
  }) async {
    final result = await _dio.patch<Map<String, dynamic>>(
      '/v1/chats/${Uri.encodeComponent(characterId)}',
      data: {'pinned': pinned, 'expectedRevision': expectedRevision},
      options: _options(bearer),
    );
    final revision = result.data?['revision'];
    if (revision is! int || revision < 0) {
      throw const FormatException('Invalid pin receipt');
    }
    return revision;
  }

  @override
  Future<void> markRead({
    required String bearer,
    required String characterId,
  }) async {
    await _dio.post<void>(
      '/v1/chats/${Uri.encodeComponent(characterId)}/read',
      options: _options(bearer),
    );
  }
}

final masanaInboxSearchProvider = Provider<MasanaInboxSearchAccess>((ref) {
  return DioMasanaInboxSearch(ref.watch(apiClientProvider).dio);
});
