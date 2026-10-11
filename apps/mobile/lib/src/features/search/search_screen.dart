import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'search_repository.dart';

/// C26: Home → Search, with the parent supplying an authenticated client,
/// exact destination routing and a changing per-account session key.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, required this.repository, required this.sessionKey,
    this.onOpen});
  final SearchRepository repository;
  final String sessionKey;
  final ValueChanged<SearchHit>? onOpen;
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}
class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _query = TextEditingController();
  Timer? _debounce;
  SearchFacet _facet = SearchFacet.masana;
  List<SearchHit> _items = const [];
  String? _cursor, _error;
  bool _loading = false, _more = false, _offline = false;
  int _generation = 0;
  String _text(String english, String hausa) =>
    Localizations.localeOf(context).languageCode == 'ha' ? hausa : english;
  @override
  void didUpdateWidget(covariant SearchScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.sessionKey != widget.sessionKey ||
        oldWidget.repository != widget.repository) {
      _generation++;
      _debounce?.cancel();
      _query.clear();
      _facet = SearchFacet.masana;
      _items = const [];
      _cursor = null; _error = null; _offline = false; _more = false; _loading = false;
    }
  }
  @override
  void dispose() {
    _generation++;
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }
  void _changed(String value) {
    _debounce?.cancel();
    _generation++;
    setState(() { _items = const []; _cursor = null; _error = null;
      _loading = false; _offline = false; _more = false; });
    if (value.trim().length < 2) return;
    _debounce = Timer(const Duration(milliseconds: 350), () => _load());
  }
  void _select(SearchFacet kind) {
    if (kind == _facet) return;
    _debounce?.cancel();
    _generation++;
    setState(() { _facet = kind; _items = const []; _cursor = null;
      _error = null; _offline = false; _loading = false; _more = false; });
    if (_query.text.trim().length >= 2) _load();
  }
  Future<void> _load({bool more = false}) async {
    final q = _query.text.trim();
    if (q.length < 2 || _loading) return;
    final key = ++_generation;
    final session = widget.sessionKey;
    final kind = _facet;
    final before = more ? _cursor : null;
    setState(() { _loading = true; _more = more; _error = null; _offline = false; });
    try {
      final page = await widget.repository.search(q, kind, cursor: before);
      if (!mounted || key != _generation || session != widget.sessionKey || kind != _facet ||
          _query.text.trim() != q) return;
      setState(() {
        _items = more ? [..._items, ...page.items] : page.items;
        _cursor = page.nextCursor;
      });
    } catch (error) {
      if (!mounted || key != _generation || session != widget.sessionKey) return;
      setState(() {
        _offline = error is DioException && (error.type == DioExceptionType.connectionError ||
          error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout);
        _error = error is DioException && error.response?.statusCode == 503
          ? _text('Search is temporarily unavailable.', 'Bincike ba ya aiki a yanzu.')
          : error is DioException && error.response?.statusCode == 403
          ? _text('You do not have access to search.', 'Ba ka da damar bincike.')
          : _text('Could not load search results.', 'An kasa loda sakamakon bincike.');
      });
    } finally {
      if (mounted && key == _generation) setState(() { _loading = false; _more = false; });
    }
  }
  String _facetName(SearchFacet facet) {
    switch (facet) {
      case SearchFacet.masana: return 'Masana';
      case SearchFacet.rooms: return _text('Rooms', 'Dakuna');
      case SearchFacet.posts: return _text('Posts', 'Rubuce-rubuce');
      case SearchFacet.videos: return _text('Videos', 'Bidiyo');
    }
  }
  @override
  Widget build(BuildContext context) {
    final q = _query.text.trim();
    return Scaffold(
      appBar: AppBar(title: Text(_text('Search Masanawa', 'Bincika Masanawa'))),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(controller: _query, onChanged: _changed,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: _text('Search Masana, Rooms, posts and videos', 'Nemo Masana, Dakuna, rubutu da bidiyo'),
              prefixIcon: const Icon(Icons.search), border: const OutlineInputBorder(),
              suffixIcon: q.isNotEmpty ? IconButton(
                tooltip: _text('Clear search', 'Goge bincike'),
                icon: const Icon(Icons.close),
                onPressed: () { _query.clear(); _changed(''); }) : null),
          )),
        SizedBox(height: 58, child: ListView(scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12), children: [
          for (final facet in SearchFacet.values)
            Padding(padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
              child: ChoiceChip(label: Text(_facetName(facet)),
                selected: _facet == facet, onSelected: (_) => _select(facet))),
        ])),
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        Expanded(child: q.length < 2
          ? Center(child: Text(_text('Enter at least two letters to search.',
              'Rubuta aƙalla haruffa biyu domin bincike.')))
          : RefreshIndicator(onRefresh: _load, child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (_error != null) Padding(padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Text(_offline ? _text('Offline — showing any earlier results.',
                    'Babu intanet — ana nuna sakamakon da aka samu.') : _error!,
                    textAlign: TextAlign.center),
                  OutlinedButton(onPressed: _loading ? null : () => _load(more: false),
                    child: Text(_text('Retry', 'Sake gwadawa'))),
                ])),
              if (_items.isEmpty && !_loading && _error == null)
                Padding(padding: const EdgeInsets.all(32),
                  child: Text(_text('No matching public results.', 'Babu sakamakon jama’a.'),
                    textAlign: TextAlign.center)),
              for (final result in _items)
                ListTile(
                  key: ValueKey('search-' + result.kind.apiValue + '-' + result.id),
                  leading: Icon(switch (result.kind) {
                    SearchFacet.masana => Icons.person_outline,
                    SearchFacet.rooms => Icons.school_outlined,
                    SearchFacet.posts => Icons.article_outlined,
                    SearchFacet.videos => Icons.play_circle_outline,
                  }),
                  title: Text(result.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                  subtitle: Text(result.subtitle, maxLines: 2, overflow: TextOverflow.ellipsis),
                  trailing: widget.onOpen == null ? null : const Icon(Icons.chevron_right),
                  onTap: widget.onOpen == null ? null : () => widget.onOpen!(result)),
              if (_cursor != null) Padding(padding: const EdgeInsets.all(16),
                child: OutlinedButton(
                  onPressed: _loading ? null : () => _load(more: true),
                  child: Text(_more ? _text('Loading…', 'Ana lodawa…') :
                    _text('Load more', 'Duba ƙari')))),
            ]))),
      ]),
    );
  }
}
