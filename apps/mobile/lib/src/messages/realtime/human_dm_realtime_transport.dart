import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';

const _maxCursor = 9223372036854775807;

enum HumanDmChange {
  messageAdded, messageChanged, messageDeleted, readChanged, accessChanged;
}

HumanDmChange _kind(dynamic v) => switch (v) {
  'message_added' => HumanDmChange.messageAdded,
  'message_changed' => HumanDmChange.messageChanged,
  'message_deleted' => HumanDmChange.messageDeleted,
  'read_changed' => HumanDmChange.readChanged,
  'access_changed' => HumanDmChange.accessChanged,
  _ => throw const FormatException('Unknown private message event'),
};
String _cursor(dynamic value) {
  if (value is! String || !RegExp(r'^(0|[1-9][0-9]{0,18})$').hasMatch(value)) {
    throw const FormatException('Invalid private-message cursor');
  }
  final number = int.tryParse(value);
  if (number == null || number < 0 || number > _maxCursor) {
    throw const FormatException('Private-message cursor is out of range');
  }
  return value;
}
Map<String,dynamic> _object(dynamic value) {
  if (value is! Map) throw const FormatException('Invalid private message event');
  return value.cast<String,dynamic>();
}
String _required(Map<String,dynamic> object, String key) {
  final value = object[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Missing private message $key');
  }
  return value;
}
class HumanDmRealtimeEvent {
  const HumanDmRealtimeEvent({
    required this.eventId,
    required this.conversationId,
    required this.kind,
    required this.actorUserId,
    this.messageId,
    this.messageSequence,
  });

  factory HumanDmRealtimeEvent.fromJson(dynamic raw) {
    final json = _object(raw);
    final kind = _kind(json['kind']);
    final msg = json['messageId'];
    final seq = json['messageSequence'];
    if (msg != null && msg is! String) {
      throw const FormatException('Invalid message event identifier');
    }
    if (seq != null) _cursor(seq);
    final messageEvent = switch (kind) {
      HumanDmChange.messageAdded || HumanDmChange.messageChanged ||
      HumanDmChange.messageDeleted => true,
      _ => false,
    };
    if (messageEvent && (msg == null || seq == null)) {
      throw const FormatException('Missing message event information');
    }
    if (kind == HumanDmChange.readChanged &&
        (msg != null || seq == null)) {
      throw const FormatException('Invalid read receipt high-water');
    }
    if (kind == HumanDmChange.accessChanged &&
        (msg != null || seq != null)) {
      throw const FormatException('Unexpected access-change payload');
    }
    return HumanDmRealtimeEvent(
      eventId: _cursor(json['eventId']),
      conversationId: _required(json,'conversationId'),
      actorUserId: _required(json,'actorUserId'),
      kind:kind,
      messageId:msg as String?,
      messageSequence:seq as String?,
    );
  }

  final String eventId;
  final String conversationId;
  final HumanDmChange kind;
  final String actorUserId;
  final String? messageId;
  final String? messageSequence;
}

class HumanDmRealtimePage {
  const HumanDmRealtimePage({
    required this.events,
    required this.nextCursor,
    required this.hasMore,
    required this.resetRequired,
  });

  factory HumanDmRealtimePage.fromJson(dynamic raw) {
    final json = _object(raw);
    final rows = json['events'];
    if (rows is! List || rows.length > 100 ||
        json['hasMore'] is! bool || json['resetRequired'] is! bool) {
      throw const FormatException('Invalid private message sync page');
    }
    final cursor = _cursor(json['nextCursor']);
    final events = rows.map(HumanDmRealtimeEvent.fromJson).toList(growable:false);
    var last = 0;
    for (final event in events) {
      final current = int.parse(event.eventId);
      if (current <= last || current > int.parse(cursor)) {
        throw const FormatException('Out-of-order private message events');
      }
      last = current;
    }
    if (events.isNotEmpty && events.last.eventId != cursor) {
      throw const FormatException('Invalid private message page checkpoint');
    }
    return HumanDmRealtimePage(
      events:List.unmodifiable(events),
      nextCursor:cursor,
      hasMore:json['hasMore'] as bool,
      resetRequired:json['resetRequired'] as bool,
    );
  }

  final List<HumanDmRealtimeEvent> events;
  final String nextCursor;
  final bool hasMore;
  final bool resetRequired;
}

abstract interface class HumanDmRealtimeTransport {
  Future<HumanDmRealtimePage> poll({
    String? cursor,
    int limit = 50,
    int waitMs = 10000,
    CancelToken? cancelToken,
  });
}
/// Reads through canonical API client bearer/refresh. A response may be
/// dropped on account/session change; it is never proof of recipient delivery.
class GatewayHumanDmRealtimeTransport implements HumanDmRealtimeTransport {
  GatewayHumanDmRealtimeTransport(this.api);
  final ApiClient api;

  @override
  Future<HumanDmRealtimePage> poll({
    String? cursor, int limit = 50, int waitMs = 10000,
    CancelToken? cancelToken,
  }) async {
    if (api.accessToken == null || api.accessToken!.isEmpty) {
      throw const ApiException('Sign in to sync private messages',
          statusCode:401,code:'AUTH_REQUIRED');
    }
    if (cursor != null) _cursor(cursor);
    if (limit < 1 || limit > 100 || waitMs < 0 || waitMs > 15000) {
      throw RangeError('Invalid private-message sync bounds');
    }
    final response = await api.dio.get<dynamic>(
      '/messages/sync',
      queryParameters: {
        if (cursor != null) 'cursor':cursor,
        'limit':limit,'waitMs':cursor == null ? 0 : waitMs,
      },
      cancelToken:cancelToken,
    );
    return HumanDmRealtimePage.fromJson(response.data);
  }
}
