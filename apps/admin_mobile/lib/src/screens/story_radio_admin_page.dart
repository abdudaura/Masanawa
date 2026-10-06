import 'package:flutter/material.dart';

import '../core/story_radio_admin_api.dart';

class StoryRadioAdminPage extends StatefulWidget {
  const StoryRadioAdminPage({super.key, required this.api});

  final StoryRadioAdminApi api;

  @override
  State<StoryRadioAdminPage> createState() => _StoryRadioAdminPageState();
}

class _StoryRadioAdminPageState extends State<StoryRadioAdminPage> {
  late Future<List<StoryAdminSeries>> _future = widget.api.listSeries();

  void _reload() => setState(() => _future = widget.api.listSeries());

  Future<void> _createSeries() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => StorySeriesEditorPage(api: widget.api),
      ),
    );
    if (changed == true && mounted) _reload();
  }

  Future<void> _editSeries(StoryAdminSeries series) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => StorySeriesEditorPage(
          api: widget.api,
          initial: series,
        ),
      ),
    );
    if (changed == true && mounted) _reload();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<List<StoryAdminSeries>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _ErrorPanel(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }
          final items = snapshot.data ?? const <StoryAdminSeries>[];
          return RefreshIndicator(
            onRefresh: () async {
              final next = widget.api.listSeries();
              setState(() => _future = next);
              await next;
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Story Radio',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: _createSeries,
                      icon: const Icon(Icons.add),
                      label: const Text('New series'),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Create serialized audio stories and control what listeners can hear.',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 14),
                if (items.isEmpty)
                  const Card(
                    child: ListTile(
                      leading: Icon(Icons.headphones_outlined),
                      title: Text('No Story Radio series yet'),
                      subtitle: Text('Create a draft series to begin publishing.'),
                    ),
                  )
                else
                  ...items.map(
                    (series) => Card(
                      child: ListTile(
                        onTap: () => _editSeries(series),
                        leading: CircleAvatar(
                          child: Icon(
                            series.published
                                ? Icons.podcasts
                                : Icons.edit_note_outlined,
                          ),
                        ),
                        title: Text(series.title),
                        subtitle: Text(
                          '${series.language} · ${series.episodes.length} episodes · ${series.state}',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      );
}

class StorySeriesEditorPage extends StatefulWidget {
  const StorySeriesEditorPage({
    super.key,
    required this.api,
    this.initial,
  });

  final StoryRadioAdminApi api;
  final StoryAdminSeries? initial;

  @override
  State<StorySeriesEditorPage> createState() => _StorySeriesEditorPageState();
}

class _StorySeriesEditorPageState extends State<StorySeriesEditorPage> {
  late StoryAdminSeries? _series = widget.initial;
  late final TextEditingController _title =
      TextEditingController(text: _series?.title ?? '');
  late final TextEditingController _description =
      TextEditingController(text: _series?.description ?? '');
  late final TextEditingController _language =
      TextEditingController(text: _series?.language ?? 'English');
  late final TextEditingController _audience =
      TextEditingController(text: _series?.audienceLabel ?? '');
  late final TextEditingController _artwork =
      TextEditingController(text: _series?.artworkUrl ?? '');
  bool _saving = false;
  String? _error;

  Future<StoryAdminSeries?> _reloadCurrent(String seriesId) async {
    final all = await widget.api.listSeries();
    for (final item in all) {
      if (item.seriesId == seriesId) return item;
    }
    return null;
  }

  Future<void> _save() async {
    if (_title.text.trim().isEmpty || _language.text.trim().isEmpty) {
      setState(() => _error = 'Title and language are required.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final current = _series;
      final saved = current == null
          ? await widget.api.createSeries(
              title: _title.text,
              description: _description.text,
              language: _language.text,
              audienceLabel: _audience.text,
              artworkUrl: _artwork.text,
            )
          : await widget.api.updateSeries(
              current,
              title: _title.text,
              description: _description.text,
              language: _language.text,
              audienceLabel: _audience.text,
              artworkUrl: _artwork.text,
            );
      if (mounted) {
        setState(() => _series = saved);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Series saved.')),
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _togglePublication() async {
    final current = _series;
    if (current == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.setSeriesPublished(
        current.seriesId,
        published: !current.published,
      );
      final refreshed = await _reloadCurrent(current.seriesId);
      if (mounted && refreshed != null) {
        setState(() => _series = refreshed);
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _editEpisode([StoryAdminEpisode? episode]) async {
    final current = _series;
    if (current == null) {
      setState(() => _error = 'Save the series before adding episodes.');
      return;
    }
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => StoryEpisodeEditorPage(
          api: widget.api,
          seriesId: current.seriesId,
          initial: episode,
        ),
      ),
    );
    if (changed == true && mounted) {
      final refreshed = await _reloadCurrent(current.seriesId);
      if (refreshed != null && mounted) {
        setState(() => _series = refreshed);
      }
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _language.dispose();
    _audience.dispose();
    _artwork.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final series = _series;
    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && mounted) Navigator.of(context).pop(series != widget.initial);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(series == null ? 'New Story series' : 'Edit Story series'),
          actions: [
            if (series != null)
              TextButton(
                onPressed: _saving ? null : _togglePublication,
                child: Text(series.published ? 'Unpublish' : 'Publish'),
              ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Series title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _description,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _language,
              decoration: const InputDecoration(labelText: 'Language'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _audience,
              decoration: const InputDecoration(
                labelText: 'Audience label',
                hintText: 'Optional',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _artwork,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                labelText: 'Artwork HTTPS URL',
                hintText: 'Optional',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Saving…' : 'Save series'),
            ),
            if (series != null) ...[
              const SizedBox(height: 28),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Episodes',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: _saving ? null : () => _editEpisode(),
                    icon: const Icon(Icons.add),
                    label: const Text('Add episode'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (series.episodes.isEmpty)
                const Card(
                  child: ListTile(
                    title: Text('No episodes yet'),
                    subtitle: Text(
                      'At least one published episode is required before the series can be published.',
                    ),
                  ),
                )
              else
                ...series.episodes.map(
                  (episode) => Card(
                    child: ListTile(
                      onTap: () => _editEpisode(episode),
                      leading: Icon(
                        episode.published
                            ? Icons.play_circle_fill_outlined
                            : Icons.radio_button_unchecked,
                      ),
                      title: Text(episode.title),
                      subtitle: Text(
                        'Season ${episode.seasonNumber} · Episode ${episode.episodeNumber} · ${episode.state}',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                    ),
                  ),
                ),
            ],
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class StoryEpisodeEditorPage extends StatefulWidget {
  const StoryEpisodeEditorPage({
    super.key,
    required this.api,
    required this.seriesId,
    this.initial,
  });

  final StoryRadioAdminApi api;
  final String seriesId;
  final StoryAdminEpisode? initial;

  @override
  State<StoryEpisodeEditorPage> createState() => _StoryEpisodeEditorPageState();
}

class _StoryEpisodeEditorPageState extends State<StoryEpisodeEditorPage> {
  late StoryAdminEpisode? _episode = widget.initial;
  late final TextEditingController _season = TextEditingController(
    text: (_episode?.seasonNumber ?? 1).toString(),
  );
  late final TextEditingController _number = TextEditingController(
    text: (_episode?.episodeNumber ?? 1).toString(),
  );
  late final TextEditingController _title =
      TextEditingController(text: _episode?.title ?? '');
  late final TextEditingController _description =
      TextEditingController(text: _episode?.description ?? '');
  late final TextEditingController _duration = TextEditingController(
    text: (_episode?.durationSeconds ?? 300).toString(),
  );
  late final TextEditingController _audio =
      TextEditingController(text: _episode?.audioUrl ?? '');
  late final TextEditingController _artwork =
      TextEditingController(text: _episode?.artworkUrl ?? '');
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    final season = int.tryParse(_season.text.trim());
    final number = int.tryParse(_number.text.trim());
    final duration = int.tryParse(_duration.text.trim());
    final audio = _audio.text.trim();
    final uri = Uri.tryParse(audio);
    if (season == null ||
        season < 1 ||
        number == null ||
        number < 1 ||
        duration == null ||
        duration < 1 ||
        _title.text.trim().isEmpty ||
        uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty) {
      setState(() {
        _error =
            'Season, episode, title, duration and a valid HTTPS audio URL are required.';
      });
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final current = _episode;
      final saved = current == null
          ? await widget.api.createEpisode(
              seriesId: widget.seriesId,
              seasonNumber: season,
              episodeNumber: number,
              title: _title.text,
              description: _description.text,
              durationSeconds: duration,
              audioUrl: audio,
              artworkUrl: _artwork.text,
            )
          : await widget.api.updateEpisode(
              current,
              seasonNumber: season,
              episodeNumber: number,
              title: _title.text,
              description: _description.text,
              durationSeconds: duration,
              audioUrl: audio,
              artworkUrl: _artwork.text,
            );
      if (mounted) {
        setState(() => _episode = saved);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Episode saved.')),
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _togglePublication() async {
    final current = _episode;
    if (current == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.api.setEpisodePublished(
        current.episodeId,
        published: !current.published,
      );
      if (mounted) {
        setState(() {
          _episode = StoryAdminEpisode(
            episodeId: current.episodeId,
            seriesId: current.seriesId,
            seasonNumber: current.seasonNumber,
            episodeNumber: current.episodeNumber,
            title: current.title,
            description: current.description,
            durationSeconds: current.durationSeconds,
            audioUrl: current.audioUrl,
            artworkUrl: current.artworkUrl,
            state: current.published ? 'draft' : 'published',
          );
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _season.dispose();
    _number.dispose();
    _title.dispose();
    _description.dispose();
    _duration.dispose();
    _audio.dispose();
    _artwork.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final episode = _episode;
    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && mounted) Navigator.of(context).pop(episode != widget.initial);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(episode == null ? 'New episode' : 'Edit episode'),
          actions: [
            if (episode != null)
              TextButton(
                onPressed: _saving ? null : _togglePublication,
                child: Text(episode.published ? 'Unpublish' : 'Publish'),
              ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _season,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Season'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _number,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Episode'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Episode title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _description,
              minLines: 3,
              maxLines: 6,
              decoration: const InputDecoration(labelText: 'Description'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _duration,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Duration in seconds',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _audio,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(labelText: 'Audio HTTPS URL'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _artwork,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                labelText: 'Artwork HTTPS URL',
                hintText: 'Optional',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Saving…' : 'Save episode'),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 42),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: onRetry,
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
}
