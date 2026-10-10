import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'video_models.dart';

typedef VideoLoader = Future<List<ExternalVideo>> Function({String? provider});
typedef VideoOpener = Future<bool> Function(Uri);

/// C27/C29. Only the official provider app opens; do not fake an embedded player.
class ExternalVideosScreen extends StatefulWidget {
  const ExternalVideosScreen({required this.load, this.open, this.languageCode = 'en', super.key});
  final VideoLoader load;
  final VideoOpener? open;
  final String languageCode;
  @override State<ExternalVideosScreen> createState() => _ExternalVideosScreenState();
}
class _ExternalVideosScreenState extends State<ExternalVideosScreen> {
  String? filter;
  late Future<List<ExternalVideo>> future = widget.load();
  String? error;
  String t(String en, String ha) => widget.languageCode == 'ha' ? ha : en;
  void reload([String? f]) => setState(() { filter = f; future = widget.load(provider: f); error = null; });
  @override Widget build(BuildContext context) => Column(children: [
    SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
      for (final p in <String?>[null, 'youtube', 'tiktok', 'facebook'])
        Padding(padding: const EdgeInsets.all(4), child: ChoiceChip(
          label: Text(p ?? t('All', 'Duka')), selected: filter == p, onSelected: (_) => reload(p))),
    ])),
    if (error != null) ListTile(title: Text(error!), trailing: IconButton(icon: const Icon(Icons.close),
      tooltip: t('Dismiss', 'Rufe'), onPressed: () => setState(() => error = null))),
    Expanded(child: FutureBuilder<List<ExternalVideo>>(future: future, builder: (context, s) {
      if (s.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
      if (s.hasError) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(t('Videos offline or unavailable', 'Babu bidiyo ko intanet')),
        TextButton(onPressed: () => reload(filter), child: Text(t('Retry', 'Sake gwadawa'))),
      ]));
      final items = s.data ?? [];
      if (items.isEmpty) return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(t('No approved videos', 'Babu bidiyon da aka amince da su')),
        TextButton(onPressed: () => reload(filter), child: Text(t('Refresh', 'Sabunta'))),
      ]));
      return RefreshIndicator(onRefresh: () async { reload(filter); await future; },
        child: ListView.builder(key: const PageStorageKey('approved-videos'), itemCount: items.length,
          itemBuilder: (context, i) {
            final v = items[i];
            return Card(child: ListTile(
              leading: const Icon(Icons.ondemand_video_outlined), title: Text(v.title),
              subtitle: Text(v.channelName + ' · ' + v.provider),
              trailing: const Icon(Icons.open_in_new), onTap: () async {
                final opened = await (widget.open?.call(v.sourceUrl) ??
                  launchUrl(v.sourceUrl, mode: LaunchMode.externalApplication));
                if (!opened && mounted) setState(() => error = t('Open this video in its provider app', 'Buɗe wannan bidiyon a manhajar asali'));
              },
            ));
          }));
    })),
  ]);
}
