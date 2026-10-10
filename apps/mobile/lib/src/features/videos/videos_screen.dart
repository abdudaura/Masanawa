import 'package:flutter/material.dart';
import 'video_models.dart';

/// L-VIDEO source-first consumer screen. Host app supplies server-approved video
/// items; this UI never accepts raw embed HTML or loads a homemade MP4 player.
class VideosScreen extends StatefulWidget {
  const VideosScreen({super.key, required this.state, required this.videos,
    required this.onOpenProvider, this.onRetry, this.onRefresh, this.onPlay});
  final VideosLoadState state;
  final List<CuratedVideo> videos;
  final ValueChanged<CuratedVideo> onOpenProvider;
  final ValueChanged<CuratedVideo>? onPlay;
  final VoidCallback? onRetry;
  final Future<void> Function()? onRefresh;
  @override
  State<VideosScreen> createState() => _VideosScreenState();
}
class _VideosScreenState extends State<VideosScreen> {
  ExternalVideoProvider? filter;
  @override
  Widget build(BuildContext context) {
    final items = widget.videos.where((v) => filter == null || v.provider == filter).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Videos')),
      body: switch (widget.state) {
        VideosLoadState.loading => const Center(child: CircularProgressIndicator()),
        VideosLoadState.error => _notice(Icons.error_outline, 'Could not load videos', 'Retry', widget.onRetry),
        VideosLoadState.offline => _notice(Icons.wifi_off, 'You are offline', 'Retry', widget.onRetry),
        VideosLoadState.empty => _notice(Icons.video_library_outlined, 'No curated videos yet', 'Refresh', widget.onRetry),
        VideosLoadState.ready => Column(children: [
          SingleChildScrollView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.all(8),
            child: Row(children: [
              _chip('All', null),
              for (final p in ExternalVideoProvider.values) _chip(p.name[0].toUpperCase() + p.name.substring(1), p),
            ])),
          Expanded(child: items.isEmpty
            ? const Center(child: Text('No videos for this provider'))
            : RefreshIndicator(
                onRefresh: widget.onRefresh ?? () async {},
                child: ListView.builder(
                  itemCount: items.length,
                  itemBuilder: (context, index) {
                    final video = items[index];
                    return Card(
                      key: ValueKey('curated-video-${video.id}'),
                      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      child: ListTile(
                        leading: const Icon(Icons.ondemand_video_outlined),
                        title: Text(video.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                        subtitle: Text('${video.channelName} · ${video.providerLabel}'),
                        onTap: widget.onPlay == null ? () => widget.onOpenProvider(video) : () => widget.onPlay!(video),
                        trailing: IconButton(
                          tooltip: 'Open in ${video.providerLabel}',
                          icon: const Icon(Icons.open_in_new),
                          onPressed: () => widget.onOpenProvider(video),
                        ),
                      ),
                    );
                  },
                ),
              )),
        ]),
      },
    );
  }
  Widget _chip(String label, ExternalVideoProvider? value) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 4),
    child: ChoiceChip(label: Text(label), selected: filter == value,
      onSelected: (_) => setState(() => filter = value)));
  Widget _notice(IconData icon, String message, String action, VoidCallback? callback) =>
    Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 40), const SizedBox(height: 12), Text(message),
      if (callback != null) TextButton(onPressed: callback, child: Text(action)),
    ]));
}
