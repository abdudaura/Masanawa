import 'package:dio/dio.dart';

enum SearchFacet { masana, rooms, posts, videos }
extension SearchFacetValue on SearchFacet {
  String get apiValue => name;
}

class SearchHit {
  const SearchHit({
    required this.kind, required this.id, required this.title,
    required this.subtitle, this.sourceUrl,
  });
  final SearchFacet kind;
  final String id, title, subtitle;
  final String? sourceUrl;
  factory SearchHit.fromJson(Map<String, dynamic> raw) {
    final kind = SearchFacet.values.where((v) => v.apiValue == raw['kind']);
    if (kind.length != 1) throw const FormatException('Unexpected search category');
    final id = raw['id'];
    final title = raw['title'];
    final subtitle = raw['subtitle'];
    if (id is! String || id.isEmpty || id.length > 160 ||
        title is! String || title.isEmpty || subtitle is! String ||
        title.length > 512 || subtitle.length > 512) {
      throw const FormatException('Invalid search result');
    }
    final link = raw['sourceUrl'];
    if (link != null && (link is! String || link.length > 2048)) {
      throw const FormatException('Invalid source link');
    }
    return SearchHit(kind: kind.single, id: id, title: title,
      subtitle: subtitle, sourceUrl: link as String?);
  }
}
class SearchPage {
  const SearchPage(this.items, this.nextCursor);
  final List<SearchHit> items;
  final String? nextCursor;
  factory SearchPage.fromJson(Map<String, dynamic> raw) {
    final values = raw['items'];
    if (values is! List || values.length > 20) {
      throw const FormatException('Invalid search page');
    }
    final cursor = raw['nextCursor'];
    if (cursor != null && (cursor is! String || cursor.isEmpty || cursor.length > 160)) {
      throw const FormatException('Invalid search cursor');
    }
    return SearchPage(values.map((value) {
      if (value is! Map) throw const FormatException('Invalid search item');
      return SearchHit.fromJson(Map<String, dynamic>.from(value));
    }).toList(growable: false), cursor as String?);
  }
}
abstract class SearchRepository {
  Future<SearchPage> search(String query, SearchFacet kind, {String? cursor});
}
/// Inherits base URL, auth headers, TLS and logout behavior from the app-owned Dio.
class DioSearchRepository implements SearchRepository {
  DioSearchRepository(this.dio);
  final Dio dio;
  @override
  Future<SearchPage> search(String query, SearchFacet kind, {String? cursor}) async {
    final response = await dio.get<Map<String, dynamic>>('/v1/search',
      queryParameters: {'q': query, 'kind': kind.apiValue, 'limit': 15,
        'cursor': ?cursor});
    if (response.data == null) throw const FormatException('Missing search response');
    final page = SearchPage.fromJson(response.data!);
    if (page.items.any((item) => item.kind != kind)) {
      throw const FormatException('Search result category mismatch');
    }
    return page;
  }
}
