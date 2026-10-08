import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../core/network/api_client.dart';

enum ResearchMode { general, current }
enum ResearchStatus { sourcesFound, insufficientEvidence, noSources }

class ResearchSource {
  const ResearchSource({
    required this.referenceId, required this.title, required this.url,
    required this.domain, required this.excerpt, this.publishedAt,
  });
  final String referenceId;
  final String title;
  final Uri url;
  final String domain;
  final String excerpt;
  final DateTime? publishedAt;

  factory ResearchSource.fromJson(Map<String, dynamic> json) {
    final raw = json['url'];
    final uri = raw is String ? Uri.tryParse(raw) : null;
    final domain = json['domain'];
    if (uri == null || uri.scheme != 'https' ||
        uri.host.isEmpty || uri.hasPort || uri.userInfo.isNotEmpty ||
        uri.hasFragment || uri.host == 'localhost' ||
        RegExp(r'^\d+\.\d+\.\d+\.\d+$').hasMatch(uri.host) ||
        domain is! String || domain != uri.host ||
        json['evidenceKind'] != 'indexed_excerpt') {
      throw const FormatException('Untrusted research source');
    }
    String short(String key, int maximum) {
      final value = json[key];
      if (value is! String || value.isEmpty || value.length > maximum) {
        throw const FormatException('Invalid research source');
      }
      return value;
    }
    return ResearchSource(
      referenceId: short('referenceId', 64),
      title: short('title', 160),
      url: uri, domain: domain, excerpt: short('excerpt', 420),
      publishedAt: json['publishedAt'] is String
          ? DateTime.tryParse(json['publishedAt'] as String)?.toUtc()
          : null,
    );
  }
}

class ResearchResult {
  const ResearchResult({
    required this.mode, required this.status, required this.checkedAt,
    required this.sources, required this.caveat,
  });
  final ResearchMode mode;
  final ResearchStatus status;
  final DateTime checkedAt;
  final List<ResearchSource> sources;
  final String caveat;
  bool get canClaimCurrentEvidence =>
      mode == ResearchMode.current && status == ResearchStatus.sourcesFound;

  factory ResearchResult.fromJson(Map<String, dynamic> json) {
    final mode = switch (json['mode']) {
      'general' => ResearchMode.general,
      'current' => ResearchMode.current,
      _ => throw const FormatException('Invalid research mode'),
    };
    final status = switch (json['status']) {
      'sources_found' => ResearchStatus.sourcesFound,
      'insufficient_evidence' => ResearchStatus.insufficientEvidence,
      'no_sources' => ResearchStatus.noSources,
      _ => throw const FormatException('Invalid research evidence status'),
    };
    final sources = json['sources'];
    final checked = json['checkedAt'];
    if (sources is! List || sources.length > 8 || checked is! String ||
        DateTime.tryParse(checked) == null || json['caveat'] is! String) {
      throw const FormatException('Invalid research result');
    }
    final parsed = sources.map((element) {
      if (element is! Map) throw const FormatException('Invalid source');
      return ResearchSource.fromJson(element.cast<String, dynamic>());
    }).toList(growable: false);
    if (json['sourceCount'] != parsed.length ||
        (status == ResearchStatus.noSources && parsed.isNotEmpty) ||
        (status == ResearchStatus.sourcesFound && parsed.isEmpty)) {
      throw const FormatException('Contradictory research evidence');
    }
    return ResearchResult(
      mode: mode, status: status,
      checkedAt: DateTime.parse(checked).toUtc(),
      sources: List.unmodifiable(parsed), caveat: json['caveat'] as String,
    );
  }
}

abstract interface class ResearchTransport {
  Future<ResearchResult> search({
    required String query, required ResearchMode mode,
    CancelToken? cancelToken,
  });
}

class GatewayResearchTransport implements ResearchTransport {
  const GatewayResearchTransport(this.api);
  final ApiClient api;

  @override
  Future<ResearchResult> search({
    required String query, required ResearchMode mode,
    CancelToken? cancelToken,
  }) async {
    final normalized = query.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (normalized.length < 3 || normalized.length > 180) {
      throw const FormatException('Enter a research question (3-180 characters).');
    }
    // Existing session-authenticated Dio only. Never treat 404 as empty success.
    final response = await api.dio.post<dynamic>(
      '/agent/research',
      data: {'query': normalized, 'mode': mode.name, 'limit': 5},
      cancelToken: cancelToken,
      options: Options(headers: {'Cache-Control': 'no-store'}),
    );
    final data = response.data;
    if (data is! Map) throw const FormatException('Invalid research response');
    return ResearchResult.fromJson(data.cast<String, dynamic>());
  }
}

/// Per-account memory only. Sign-out and account switch purge all results.
class ResearchController extends ChangeNotifier {
  ResearchController(this.transport, {required String accountKey})
      : _accountKey = accountKey;
  final ResearchTransport transport;
  String _accountKey;
  int _generation = 0;
  CancelToken? _pending;
  ResearchResult? result;
  bool loading = false;
  String? error;

  Future<void> search(String query, ResearchMode mode) async {
    final revision = ++_generation;
    _pending?.cancel('New request');
    final pending = CancelToken();
    _pending = pending;
    result = null;
    error = null;
    loading = true;
    notifyListeners();
    try {
      final response = await transport.search(
        query: query, mode: mode, cancelToken: pending,
      );
      if (revision != _generation || pending.isCancelled) return;
      result = response;
    } catch (_) {
      if (revision != _generation || pending.isCancelled) return;
      error = 'Research is unavailable. Check your connection or try later.';
    } finally {
      if (revision == _generation) {
        loading = false;
        _pending = null;
        notifyListeners();
      }
    }
  }

  void switchAccount(String accountKey) {
    if (accountKey == _accountKey) return;
    _accountKey = accountKey;
    clear();
  }

  void clear() {
    ++_generation;
    _pending?.cancel('Research context closed');
    _pending = null;
    result = null;
    error = null;
    loading = false;
    notifyListeners();
  }

  @override
  void dispose() {
    ++_generation;
    _pending?.cancel('Research closed');
    super.dispose();
  }
}
