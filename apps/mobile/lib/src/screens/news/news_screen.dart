import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/network/api_client.dart';
import '../../core/providers.dart';
import '../../rooms/news/news_models.dart';
import '../../rooms/news/news_room.dart';
import '../../theme/masanawa_theme.dart';

class NewsScreen extends ConsumerStatefulWidget {
  const NewsScreen({super.key});

  @override
  ConsumerState<NewsScreen> createState() => _NewsScreenState();
}

class _NewsScreenState extends ConsumerState<NewsScreen> {
  NewsRoomProjection? _projection;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final data = await ref.read(apiClientProvider).newsRoomProjection();
      final projection = NewsRoomProjection.fromJson(data);
      if (!mounted) return;
      setState(() {
        _projection = projection;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.message;
      });
    } on FormatException {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'News is temporarily unavailable.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Could not load News right now.';
      });
    }
  }

  void _openItem(NewsItem item) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => Scaffold(
          backgroundColor: context.masanawa.surfaceBg,
          appBar: AppBar(),
          body: SafeArea(
            child: NewsArticleView(
              item: item,
              onOpenSource: _openSource,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openSource(NewsSource source) async {
    final opened = await launchUrl(
      source.url,
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open this source.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Scaffold(
      backgroundColor: colors.surfaceBg,
      appBar: AppBar(title: const Text('News')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: _body(context),
        ),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final colors = context.masanawa;
    if (_loading && _projection == null) {
      return const ListView(
        physics: AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: 180),
          Center(child: CircularProgressIndicator()),
        ],
      );
    }
    if (_error != null && _projection == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(24, 100, 24, 24),
        children: [
          Icon(Icons.cloud_off_outlined, size: 44, color: colors.textMuted),
          const SizedBox(height: 14),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textMuted),
          ),
          const SizedBox(height: 16),
          Center(
            child: FilledButton(
              onPressed: _load,
              child: const Text('Try again'),
            ),
          ),
        ],
      );
    }
    final projection = _projection;
    if (projection == null) {
      return const SizedBox.shrink();
    }
    return NewsRoomView(
      projection: projection,
      onOpenItem: _openItem,
    );
  }
}
