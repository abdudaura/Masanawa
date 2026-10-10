import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

enum AssistantChannel { whatsapp, telegram }

extension AssistantChannelName on AssistantChannel {
  String get title => this == AssistantChannel.whatsapp ? 'WhatsApp' : 'Telegram';
}

class LinkedAssistantChannel {
  const LinkedAssistantChannel(this.channel, this.linked, this.preferred, this.pendingUntil);
  final AssistantChannel channel;
  final bool linked;
  final bool preferred;
  final DateTime? pendingUntil;
  factory LinkedAssistantChannel.fromJson(Map<String, dynamic> json) {
    final channel = AssistantChannel.values.byName(json['channel'] as String);
    return LinkedAssistantChannel(
      channel, json['linked'] == true, json['preferred'] == true,
      DateTime.tryParse(json['pendingUntil']?.toString() ?? ''),
    );
  }
}

bool trustedAssistantDestination(Uri uri, AssistantChannel channel) {
  if (uri.scheme != 'https' || uri.hasPort || uri.userInfo.isNotEmpty ||
      uri.hasQuery || uri.hasFragment) return false;
  if (channel == AssistantChannel.whatsapp) {
    return uri.host == 'wa.me' && RegExp(r'^/[1-9][0-9]{6,14}$').hasMatch(uri.path);
  }
  return uri.host == 't.me' && RegExp(r'^/[A-Za-z0-9_]{5,32}$').hasMatch(uri.path);
}

class AssistantLinkChallenge {
  const AssistantLinkChallenge(this.code, this.expires, this.destination);
  final String code;
  final DateTime expires;
  final Uri destination;

  factory AssistantLinkChallenge.fromJson(
      Map<String, dynamic> data, AssistantChannel channel) {
    final code = data['code'] as String;
    final destination = Uri.parse(data['destination'] as String);
    final expires = DateTime.parse(data['expiresAt'] as String);
    if (!RegExp(r'^MN-[A-F0-9]{24}$').hasMatch(code) ||
        !trustedAssistantDestination(destination, channel)) {
      throw const FormatException('Untrusted channel verification response');
    }
    return AssistantLinkChallenge(code, expires, destination);
  }
}

class AssistantLinkTransport {
  const AssistantLinkTransport(this.client);
  final ApiClient client;

  Future<Map<String, dynamic>> _request(String method, String path) async {
    try {
      final result = await client.dio.request<Object?>(
        path, options: Options(method: method),
      );
      if (result.data is! Map) throw const FormatException('Invalid response');
      return Map<String, dynamic>.from(result.data! as Map);
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        throw const ApiException('Sign in again to manage channels.', code: 'UNAUTHORIZED');
      }
      if (error.response?.statusCode == 429) {
        throw const ApiException('Too many attempts. Try again later.', code: 'LINK_RATE_LIMITED');
      }
      if (error.response?.statusCode == 409) {
        throw const ApiException('This channel is already linked or no longer eligible.', code: 'LINK_CONFLICT');
      }
      throw const ApiException('Channel settings are unavailable. No change was confirmed.',
          code: 'CHANNEL_UNAVAILABLE');
    }
  }

  Future<List<LinkedAssistantChannel>> status() async {
    final result = await _request('GET', '/me/linked-channels');
    final channels = result['channels'];
    if (channels is! List) throw const FormatException('Invalid list');
    return channels.map((value) =>
        LinkedAssistantChannel.fromJson(Map<String, dynamic>.from(value as Map)))
      .toList(growable: false);
  }
  Future<AssistantLinkChallenge> begin(AssistantChannel channel) async =>
      AssistantLinkChallenge.fromJson(
        await _request('POST', '/me/linked-channels/' + channel.name + '/begin'),
        channel,
      );
  Future<void> unlink(AssistantChannel channel) async {
    await _request('DELETE', '/me/linked-channels/' + channel.name);
  }
  Future<void> prefer(AssistantChannel channel) async {
    await _request('POST', '/me/linked-channels/' + channel.name + '/prefer');
  }
}
