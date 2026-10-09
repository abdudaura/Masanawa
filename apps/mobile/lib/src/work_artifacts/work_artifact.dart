import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';

class WorkArtifact {
  const WorkArtifact({required this.id, required this.filename, required this.state,
    required this.revision, required this.sizeBytes, required this.sha256,
    required this.expiresAt, required this.owned});
  final String id, filename, state, sha256;
  final int revision, sizeBytes;
  final DateTime expiresAt;
  final bool owned;
  bool get ready => state == 'ready' && expiresAt.isAfter(DateTime.now());
  factory WorkArtifact.parse(dynamic value) {
    if (value is! Map || value['id'] is! String || value['filename'] is! String ||
        value['revision'] is! int || value['revision'] < 1 || value['owned'] is! bool ||
        value['sizeBytes'] is! int || value['sizeBytes'] < 1 || value['sizeBytes'] > 262144 ||
        value['sha256'] is! String || !RegExp(r'^[a-f0-9]{64}$').hasMatch(value['sha256']) ||
        value['mimeType'] != 'text/plain; charset=utf-8' ||
        !{'generating','ready','failed','revoked','deleting','deleted'}.contains(value['state'])) {
      throw const FormatException('Invalid artifact response');
    }
    return WorkArtifact(id:value['id'], filename:value['filename'], state:value['state'],
      revision:value['revision'], sizeBytes:value['sizeBytes'], sha256:value['sha256'],
      expiresAt:DateTime.parse(value['expiresAt'] as String), owned:value['owned']);
  }
}
abstract interface class ArtifactTransport {
  Future<WorkArtifact> load(String account, String id, CancelToken cancel);
  Future<Uint8List> download(String account, WorkArtifact artifact, CancelToken cancel,
    void Function(int,int) progress);
  Future<WorkArtifact> recover(String account, String id, CancelToken cancel);
  Future<WorkArtifact> revoke(String account, WorkArtifact artifact, CancelToken cancel);
  Future<WorkArtifact> remove(String account, String id, CancelToken cancel);
  Future<WorkArtifact> share(String account, WorkArtifact artifact, String recipientUserId, CancelToken cancel);
}

/// Uses the existing refresh-aware ApiClient; never accepts a model URL or a developer token.
class GatewayArtifactTransport implements ArtifactTransport {
  GatewayArtifactTransport({required this.api, required this.currentAccount});
  final ApiClient api;
  /// Canonical signed-in tenant/user identity key; null during logout/restoration.
  final String? Function() currentAccount;
  void _check(String account, CancelToken cancel) {
    if (cancel.isCancelled || currentAccount() != account) throw StateError('Account changed');
  }
  String _path(String id) {
    if (!RegExp(r'^media-artifact_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$').hasMatch(id)) {
      throw const FormatException('Invalid artifact reference');
    }
    return '/work-artifacts/$id';
  }
  Future<WorkArtifact> _json(String account, String id, CancelToken cancel, String method,
    [String suffix='', Map<String,dynamic>? data]) async {
    _check(account,cancel);
    final response=await api.dio.request<dynamic>('${_path(id)}$suffix', data:data,
      cancelToken:cancel, options:Options(method:method,followRedirects:false));
    _check(account,cancel);
    final artifact=WorkArtifact.parse(response.data);
    if (artifact.id != id) throw const FormatException('Artifact reference mismatch');
    return artifact;
  }
  @override
  Future<WorkArtifact> load(String a,String id,CancelToken c)=>_json(a,id,c,'GET');
  @override
  Future<WorkArtifact> recover(String a,String id,CancelToken c)=>_json(a,id,c,'POST','/recover',{});
  @override
  Future<WorkArtifact> revoke(String a,WorkArtifact f,CancelToken c)=>_json(a,f.id,c,'POST','/revoke',{'revision':f.revision});
  @override
  Future<WorkArtifact> remove(String a,String id,CancelToken c)=>_json(a,id,c,'DELETE');
  @override
  Future<WorkArtifact> share(String a,WorkArtifact f,String recipient,CancelToken c)=>
    _json(a,f.id,c,'POST','/share',{'revision':f.revision,'recipientUserId':recipient,'ttlSeconds':3600});
  @override
  Future<Uint8List> download(String account,WorkArtifact artifact,CancelToken cancel,void Function(int,int) progress) async {
    _check(account,cancel);
    final ticketResponse=await api.dio.post<dynamic>('${_path(artifact.id)}/ticket',data:{},cancelToken:cancel,
      options:Options(followRedirects:false));
    _check(account,cancel);
    final ticket=ticketResponse.data;
    if (ticket is! Map || ticket['ticket'] is! String || ticket['ticket'].length > 2048) {
      throw const FormatException('Invalid download authorization');
    }
    final response=await api.dio.post<ResponseBody>('${_path(artifact.id)}/download',data:{'ticket':ticket['ticket']},
      cancelToken:cancel,options:Options(responseType:ResponseType.stream,followRedirects:false));
    _check(account,cancel);
    final body=response.data;
    if (body == null) throw const FormatException('Missing artifact');
    final builder=BytesBuilder(copy:false);var count=0;
    try {
      if (response.headers.value('x-artifact-sha256') != artifact.sha256 ||
          !(response.headers.value('content-type') ?? '').startsWith('text/plain')) {
        throw const FormatException('Unverified artifact response');
      }
      await for(final chunk in body.stream.timeout(const Duration(seconds:20))) {
        _check(account,cancel);count+=chunk.length;
        if (count > 262144 || count > artifact.sizeBytes) throw const FormatException('Artifact too large');
        builder.add(chunk);progress(count,artifact.sizeBytes);
      }
      _check(account,cancel);
      if (count != artifact.sizeBytes) throw const FormatException('Incomplete download');
      final bytes=builder.takeBytes();utf8.decode(bytes,allowMalformed:false);
      return bytes;
    } catch (_) {
      cancel.cancel('Artifact download interrupted');rethrow;
    }
  }
}
