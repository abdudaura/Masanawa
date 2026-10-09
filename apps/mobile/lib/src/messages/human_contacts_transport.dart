import 'package:dio/dio.dart';

import '../core/network/api_client.dart';

/// Human-only contacts. These IDs are platform user IDs, never persona IDs.
enum HumanContactPolicy { anyone, requests, nobody }

enum HumanContactStatus { none, incoming, outgoing, accepted, declined, revoked }

HumanContactPolicy _policy(dynamic value) => switch (value) {
  'anyone' => HumanContactPolicy.anyone,
  'requests' => HumanContactPolicy.requests,
  'nobody' => HumanContactPolicy.nobody,
  _ => throw const FormatException('Invalid contact privacy policy'),
};

HumanContactStatus _status(dynamic value) => switch (value) {
  'none' => HumanContactStatus.none,
  'incoming' => HumanContactStatus.incoming,
  'outgoing' => HumanContactStatus.outgoing,
  'accepted' => HumanContactStatus.accepted,
  'declined' => HumanContactStatus.declined,
  'revoked' => HumanContactStatus.revoked,
  _ => throw const FormatException('Invalid contact status'),
};

Map<String, dynamic> _object(dynamic raw) {
  if (raw is! Map) {
    throw const FormatException('Invalid contacts response');
  }
  return raw.cast<String, dynamic>();
}

String _requiredString(Map<String, dynamic> source, String name) {
  final value = source[name];
  if (value is! String || value.isEmpty) {
    throw FormatException('Invalid contact $name');
  }
  return value;
}

class HumanContactPreferences {
  const HumanContactPreferences({
    required this.policy,
    required this.discoverableByHandle,
  });

  factory HumanContactPreferences.fromJson(dynamic raw) {
    final json = _object(raw);
    final visible = json['discoverableByHandle'];
    if (visible is! bool) {
      throw const FormatException('Invalid contact discoverability');
    }
    return HumanContactPreferences(
      policy: _policy(json['policy']),
      discoverableByHandle: visible,
    );
  }

  final HumanContactPolicy policy;
  final bool discoverableByHandle;
}

class HumanContact {
  const HumanContact({
    required this.userId,
    required this.handle,
    required this.displayName,
    required this.avatarUrl,
    required this.status,
    required this.canMessage,
    this.updatedAt,
    this.requestRevision,
  });

  factory HumanContact.fromJson(dynamic raw, {bool fromLookup = false}) {
    final json = _object(raw);
    final avatar = json['avatarUrl'];
    if (avatar != null && avatar is! String) {
      throw const FormatException('Invalid contact avatar');
    }
    final messaging = json['canMessage'];
    if (fromLookup && messaging is! bool) {
      throw const FormatException('Invalid contact eligibility');
    }
    final requestRevision = json['requestRevision'];
    final lastUpdate = json['updatedAt'];
    if (requestRevision != null &&
        (requestRevision is! String ||
            !RegExp(r'^[1-9][0-9]{0,18}$').hasMatch(requestRevision) ||
            BigInt.parse(requestRevision) > BigInt.parse('9223372036854775807'))) {
      throw const FormatException('Invalid contact request revision');
    }
    if (!fromLookup && requestRevision == null) {
      throw const FormatException('Missing contact request revision');
    }
    if (!fromLookup && lastUpdate is! String) {
      throw const FormatException('Invalid contact update time');
    }
    return HumanContact(
      userId: _requiredString(json, 'userId'),
      handle: _requiredString(json, 'handle'),
      displayName: _requiredString(json, 'displayName'),
      avatarUrl: avatar as String?,
      status: _status(json['status']),
      canMessage: fromLookup && messaging == true,
      updatedAt: lastUpdate is String ? DateTime.tryParse(lastUpdate) : null,
      requestRevision: requestRevision as String?,
    );
  }

  final String userId;
  final String handle;
  final String displayName;
  final String? avatarUrl;
  final HumanContactStatus status;
  /// Server projection only. Actual message sends must reauthorize in C02.
  final bool canMessage;
  final DateTime? updatedAt;
  final String? requestRevision;
}

/// No phonebook ingestion, person ID supplied for lookup or client-side
/// trust of another person's privacy policy.
abstract interface class HumanContactsTransport {
  Future<HumanContact?> lookup(String handle);
  Future<HumanContactPreferences> preferences();
  Future<HumanContactPreferences> updatePreferences({
    HumanContactPolicy? policy,
    bool? discoverableByHandle,
  });
  Future<List<HumanContact>> list({int limit = 30});
  Future<String> request(String handle);
  Future<String> respond(String requesterUserId, {required bool accept, required String requestRevision});
  Future<void> revoke(String otherUserId);
}

/// Bounded authoritative list page; continuation does not grant permission.
class HumanContactPage {
  const HumanContactPage({required this.contacts, required this.nextCursor});
  final List<HumanContact> contacts;
  final String? nextCursor;
}

/// Optional interface to avoid breaking existing C01/U21 transport fakes.
abstract interface class HumanContactsPaginationTransport
    implements HumanContactsTransport {
  Future<HumanContactPage> page({int limit = 50, String? cursor});
}

class GatewayHumanContactsTransport implements HumanContactsPaginationTransport {
  GatewayHumanContactsTransport({required this.api});
  final ApiClient api;

  void _requireAuth() {
    if (api.accessToken == null || api.accessToken!.isEmpty) {
      throw const ApiException('Sign in to manage your contacts',
          statusCode: 401, code: 'AUTH_REQUIRED');
    }
  }

  /// Validation is about transport shape; the Gateway remains the authority.
  String _handle(String raw) {
    final value = raw.trim().replaceFirst(RegExp(r'^@'), '').toLowerCase();
    if (!RegExp(r'^[a-z0-9_][a-z0-9_.-]{1,39}$').hasMatch(value)) {
      throw const FormatException('Enter a valid exact @handle');
    }
    return value;
  }

  String _id(String raw) {
    if (!RegExp(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$').hasMatch(raw)) {
      throw const FormatException('Invalid human account ID');
    }
    return Uri.encodeComponent(raw);
  }

  @override
  Future<HumanContactPage> page({int limit = 50, String? cursor}) async {
    _requireAuth();
    if (limit < 1 || limit > 100) throw RangeError.range(limit, 1, 100);
    if (cursor != null &&
        (cursor.length < 8 || cursor.length > 1024 ||
            !RegExp(r'^[A-Za-z0-9_-]+$').hasMatch(cursor))) {
      throw const FormatException('Invalid contact page cursor');
    }
    final response = await api.dio.get<dynamic>(
      '/messages/contacts/page',
      queryParameters: {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      },
    );
    final json = _object(response.data);
    final rawContacts = json['contacts'];
    if (rawContacts is! List || rawContacts.length > limit ||
        !json.containsKey('nextCursor')) {
      throw const FormatException('Invalid contact page');
    }
    final next = json['nextCursor'];
    if (next != null &&
        (next is! String || next.length < 8 || next.length > 1024 ||
            !RegExp(r'^[A-Za-z0-9_-]+$').hasMatch(next) || next == cursor)) {
      throw const FormatException('Invalid next contact cursor');
    }
    return HumanContactPage(
      contacts: List.unmodifiable(
        rawContacts.map((entry) => HumanContact.fromJson(entry)),
      ),
      nextCursor: next as String?,
    );
  }

  @override
  Future<HumanContact?> lookup(String handle) async {
    _requireAuth();
    try {
      final response = await api.dio.get<dynamic>(
        '/messages/contacts/lookup/${Uri.encodeComponent(_handle(handle))}',
      );
      return HumanContact.fromJson(response.data, fromLookup: true);
    } on DioException catch (error) {
      final body = error.response?.data;
      final envelope = body is Map ? body['error'] : null;
      final code = envelope is Map ? envelope['code'] : null;
      // A missing deployment route or schema mismatch is NOT an absent person.
      if (error.response?.statusCode == 404 &&
          code == 'messages.contact_unavailable') {
        return null;
      }
      rethrow;
    }
  }

  @override
  Future<HumanContactPreferences> preferences() async {
    _requireAuth();
    final response = await api.dio.get<dynamic>(
      '/messages/contacts/preferences',
    );
    return HumanContactPreferences.fromJson(response.data);
  }

  @override
  Future<HumanContactPreferences> updatePreferences({
    HumanContactPolicy? policy,
    bool? discoverableByHandle,
  }) async {
    _requireAuth();
    if (policy == null && discoverableByHandle == null) {
      throw ArgumentError('At least one contact privacy setting must change');
    }
    final response = await api.dio.patch<dynamic>(
      '/messages/contacts/preferences',
      data: {
        if (policy != null) 'policy': policy.name,
        if (discoverableByHandle != null)
          'discoverableByHandle': discoverableByHandle,
      },
    );
    return HumanContactPreferences.fromJson(response.data);
  }

  @override
  Future<List<HumanContact>> list({int limit = 30}) async {
    _requireAuth();
    if (limit < 1 || limit > 100) throw RangeError.range(limit, 1, 100);
    final response = await api.dio.get<dynamic>(
      '/messages/contacts',
      queryParameters: {'limit': limit},
    );
    final contacts = _object(response.data)['contacts'];
    if (contacts is! List) {
      throw const FormatException('Invalid contact list');
    }
    return List.unmodifiable(
      contacts.map((json) => HumanContact.fromJson(json)),
    );
  }

  @override
  Future<String> request(String handle) async {
    _requireAuth();
    final response = await api.dio.post<dynamic>(
      '/messages/contacts/requests',
      data: {'handle': _handle(handle)},
    );
    final status = _object(response.data)['status'];
    if (status != 'accepted' && status != 'pending' && status != 'existing') {
      throw const FormatException('Invalid contact request acknowledgment');
    }
    return status as String;
  }

  @override
  Future<String> respond(
    String requesterUserId, {
    required bool accept,
    required String requestRevision,
  }) async {
    _requireAuth();
    if (!RegExp(r'^[1-9][0-9]{0,18}$').hasMatch(requestRevision) ||
        BigInt.parse(requestRevision) > BigInt.parse('9223372036854775807')) {
      throw const FormatException('Invalid contact request revision');
    }
    final response = await api.dio.post<dynamic>(
      '/messages/contacts/requests/${_id(requesterUserId)}/response',
      data: {'accept': accept, 'requestRevision': requestRevision},
    );
    final status = _object(response.data)['status'];
    if (status != (accept ? 'accepted' : 'declined')) {
      throw const FormatException('Invalid contact response');
    }
    return status as String;
  }

  @override
  Future<void> revoke(String otherUserId) async {
    _requireAuth();
    final response = await api.dio.delete<dynamic>(
      '/messages/contacts/${_id(otherUserId)}',
    );
    if (_object(response.data)['status'] != 'revoked') {
      throw const FormatException('Invalid contact revocation acknowledgment');
    }
  }
}
