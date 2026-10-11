import 'package:flutter/material.dart';
import 'video_models.dart';
import 'official_video_player_screen.dart';

typedef VideoLoader = Future<List<ExternalVideo>> Function({String? provider});
typedef VideoOpener = Future<bool> Function(Uri);

/// C27: approved-video catalog, C28 official player, C29 source fallback.
/// Account changes replace the future and never display the old account cache.
class ExternalVideosScreen extends StatefulWidget {
  const ExternalVideosScreen({
    required this.load, this.open, this.embedBuilder,
    this.accountKey = '', this.enabled = true, this.languageCode = 'en',
    super.key,
  });
  final VideoLoader load;
  final VideoOpener? open;
  final VideoEmbedBuilder? embedBuilder;
  final String accountKey;
  final bool enabled;
  final String languageCode;
  @override State<ExternalVideosScreen> createState() =>
      _ExternalVideosScreenState();
}
class _ExternalVideosScreenState extends State<ExternalVideosScreen> {
  String? filter;
  late Future<List<ExternalVideo>> future;
  String? error;
  String t(String en, String ha) => widget.languageCode == 'ha' ? ha : en;
  @override void initState() {
    super.initState();
    future = widget.load();
  }
  @override void didUpdateWidget(covariant ExternalVideosScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.load != widget.load ||
        oldWidget.accountKey != widget.accountKey) {
      filter = null;
      future = widget.load();
      error = null;
    }
  }
  void reload([String? f]) => setState(() {
    filter = f; future = widget.load(provider: f); error = null;
  });
  void openVideo(ExternalVideo video) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => OfficialVideoPlayerScreen(
        video: video, embedBuilder: widget.embedBuilder,
        open: widget.open, languageCode: widget.languageCode,
      ),
    ));
  }
  @override Widget build(BuildContext context) {
    if (!widget.enabled) {
      return Center(child: Text(t('Videos are currently unavailable',
        'Ba a samun bidiyo a yanzu')));
    }
    return Column(children: [
      SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
        for (final p in <String?>[null, 'youtube', 'tiktok', 'facebook'])
          Padding(padding: const EdgeInsets.all(4), child: ChoiceChip(
            label: Text(p ?? t('All', 'Duka')),
            selected: filter == p, onSelected: (_) => reload(p))),
      ])),
      if (error != null) ListTile(title: Text(error!),
        trailing: IconButton(icon: const Icon(Icons.close),
          tooltip: t('Dismiss', 'Rufe'),
          onPressed: () => setState(() => error = null))),
      Expanded(child: FutureBuilder<List<ExternalVideo>>(
        future: future, builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(t('Videos offline or unavailable',
                'Babu bidiyo ko intanet')),
              TextButton(onPressed: () => reload(filter),
                child: Text(t('Retry', 'Sake gwadawa'))),
            ]));
          }
          final items = snapshot.data ?? [];
          if (items.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(t('No approved videos',
                'Babu bidiyon da aka amince da su')),
              TextButton(onPressed: () => reload(filter),
                child: Text(t('Refresh', 'Sabunta'))),
            ]));
          }
          return RefreshIndicator(
            onRefresh: () async { reload(filter); try { await future; } catch (_) {} },
            child: ListView.builder(
              key: const PageStorageKey('approved-videos'),
              itemCount: items.length, itemBuilder: (context, i) {
                final video = items[i];
                return Card(child: ListTile(
                  key: ValueKey(video.id),
                  leading: const Icon(Icons.ondemand_video_outlined),
                  title: Text(video.title),
                  subtitle: Text('${video.channelName} · ${video.provider}'),
                  trailing: const Icon(Icons.play_circle_outline),
                  onTap: () => openVideo(video),
                ));
              }),
          );
        },
      )),
    ]);
  }
}
