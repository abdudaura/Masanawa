import 'package:flutter/material.dart';
import 'video_models.dart';
import 'official_video_player_screen.dart';

typedef VideoLoader = Future<List<ExternalVideo>> Function({String? provider});
typedef VideoPageLoader = Future<VideoCatalogPage> Function({
  String? provider, String? before,
});
typedef VideoOpener = Future<bool> Function(Uri);

/// C27: cursor-paged approved-video catalog; C28/C29: official player/fallback.
/// The parent owns the authenticated loader; this widget never holds credentials.
class ExternalVideosScreen extends StatefulWidget {
  const ExternalVideosScreen({
    required this.load, this.loadPage, this.open, this.embedBuilder,
    this.onOpenVideo,
    this.checkAvailability,
    this.accountKey = '', this.enabled = true, this.languageCode = 'en',
    super.key,
  });
  final VideoLoader load;
  final VideoPageLoader? loadPage;
  final VideoOpener? open;
  /// Host-owned route so account replacement unmounts the active player.
  final ValueChanged<ExternalVideo>? onOpenVideo;
  final VideoEmbedBuilder? embedBuilder;
  /// Parent injects VideoRepository.isApproved using its authenticated Dio.
  final Future<bool> Function(String id)? checkAvailability;
  final String accountKey;
  final bool enabled;
  final String languageCode;

  @override
  State<ExternalVideosScreen> createState() => _ExternalVideosScreenState();
}

class _ExternalVideosScreenState extends State<ExternalVideosScreen> {
  // Provider is a playback/security property, not a discovery filter.
  // Preserve server catalogue order as 'Recent' (never invent duration).
  String sortOrder = 'recent';
  String? filter;
  late Future<List<ExternalVideo>> future;
  int generation = 0;
  String? cursor;
  List<ExternalVideo> additional = [];
  bool loadingMore = false;
  bool pagingFailed = false;

  String t(String en, String ha) => widget.languageCode == 'ha' ? ha : en;

  Future<List<ExternalVideo>> firstPage(String? provider) async {
    final requestGeneration = generation;
    final pageLoader = widget.loadPage;
    if (pageLoader == null) return widget.load(provider: provider);
    final page = await pageLoader(provider: provider);
    if (requestGeneration == generation) cursor = page.nextCursor;
    return page.items;
  }

  @override
  void initState() {
    super.initState();
    future = widget.enabled
        ? firstPage(null) : Future.value(<ExternalVideo>[]);
  }

  @override
  void didUpdateWidget(covariant ExternalVideosScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.load != widget.load ||
        oldWidget.loadPage != widget.loadPage ||
        oldWidget.accountKey != widget.accountKey ||
        oldWidget.checkAvailability != widget.checkAvailability ||
        oldWidget.enabled != widget.enabled) {
      reset(null);
    }
  }

  void reset(String? provider) {
    generation++;
    filter = provider;
    cursor = null;
    additional = [];
    loadingMore = false;
    pagingFailed = false;
    future = widget.enabled
        ? firstPage(provider) : Future.value(<ExternalVideo>[]);
  }

  void reload([String? provider]) => setState(() => reset(provider));

  Future<void> loadMore() async {
    final loader = widget.loadPage;
    final before = cursor;
    if (loader == null || before == null || loadingMore || !widget.enabled) {
      return;
    }
    final requestGeneration = generation;
    setState(() { loadingMore = true; pagingFailed = false; });
    try {
      final page = await loader(provider: filter, before: before);
      if (!mounted || requestGeneration != generation) return;
      setState(() {
        // A source that repeats a cursor must not cause an endless load loop.
        cursor = page.nextCursor == before ? null : page.nextCursor;
        additional = [...additional, ...page.items];
        loadingMore = false;
      });
    } catch (_) {
      if (!mounted || requestGeneration != generation) return;
      setState(() { loadingMore = false; pagingFailed = true; });
    }
  }

  void openVideo(ExternalVideo video) {
    if (widget.onOpenVideo != null) {
      widget.onOpenVideo!(video);
      return;
    }
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => OfficialVideoPlayerScreen(
        video: video, embedBuilder: widget.embedBuilder,
        open: widget.open, languageCode: widget.languageCode,
        checkAvailability: widget.checkAvailability,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) {
      return Center(child: Text(t('Videos are currently unavailable',
        'Ba a samun bidiyo a yanzu')));
    }
    return Column(children: [
      // Sorting only uses fields actually supplied by the approved catalog.
      // Short/long duration is intentionally NOT exposed without metadata.
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Wrap(spacing: 8, runSpacing: 3, children: [
            for (final item in const <String>['recent', 'title', 'channel'])
              ChoiceChip(
                label: Text(switch (item) {
                  'title' => t('Title A–Z', 'Suna A–Z'),
                  'channel' => t('Channel A–Z', 'Tasha A–Z'),
                  _ => t('Recent', 'Na baya-bayan nan'),
                }),
                selected: sortOrder == item,
                onSelected: (_) => setState(() => sortOrder = item),
              ),
          ]),
        ),
      ),
      Expanded(child: FutureBuilder<List<ExternalVideo>>(
        future: future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min,
              children: [
                Text(t('Videos offline or unavailable', 'Babu bidiyo ko intanet')),
                TextButton(onPressed: () => reload(filter),
                  child: Text(t('Retry', 'Sake gwadawa'))),
              ]));
          }
          final seen = <String>{};
          final items = <ExternalVideo>[
            for (final item in [...?snapshot.data, ...additional])
              if (seen.add(item.id)) item,
          ];
          if (sortOrder == 'title') {
            items.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
          } else if (sortOrder == 'channel') {
            items.sort((a, b) => a.channelName.toLowerCase().compareTo(b.channelName.toLowerCase()));
          }
          if (items.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min,
              children: [
                Text(t('No approved videos', 'Babu bidiyon da aka amince da su')),
                TextButton(onPressed: () => reload(filter),
                  child: Text(t('Refresh', 'Sabunta'))),
              ]));
          }
          final hasNextPage = widget.loadPage != null && cursor != null;
          return RefreshIndicator(
            onRefresh: () async {
              reload(filter);
              try { await future; } catch (_) { /* Visible retry state. */ }
            },
            child: ListView.builder(
              key: PageStorageKey('approved-videos-${widget.accountKey}-${filter ?? 'all'}'),
              itemCount: items.length + (hasNextPage ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == items.length) {
                  return Center(child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: loadingMore
                      ? const CircularProgressIndicator()
                      : TextButton(
                          onPressed: loadMore,
                          child: Text(pagingFailed
                            ? t('Retry more videos', 'Sake kokarin karin bidiyo')
                            : t('Load more', 'Duba karin bidiyo')),
                        ),
                  ));
                }
                final video = items[index];
                return Card(child: ListTile(
                  key: ValueKey(video.id),
                  leading: const Icon(Icons.ondemand_video_outlined),
                  title: Text(video.title),
                  subtitle: Text('${video.channelName} · ${video.provider}'),
                  trailing: const Icon(Icons.play_circle_outline),
                  onTap: () => openVideo(video),
                ));
              },
            ),
          );
        },
      )),
    ]);
  }
}
