import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'news_models.dart';
import 'news_room.dart';
import 'news_state.dart';

class NewsScreen extends ConsumerWidget {
  const NewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(newsRoomProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('News')),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _NewsLoadError(
          message: error is Exception
              ? error.toString().replaceFirst('ApiException: ', '')
              : 'Could not load current news.',
          onRetry: () => ref.read(newsRoomProvider.notifier).refresh(),
        ),
        data: (projection) => RefreshIndicator(
          onRefresh: () => ref.read(newsRoomProvider.notifier).refresh(),
          child: NewsRoomView(
            projection: projection,
            onOpenItem: (item) => _openArticle(context, item),
          ),
        ),
      ),
    );
  }

  void _openArticle(BuildContext context, NewsItem item) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: const Text('News')),
          body: NewsArticleView(
            item: item,
            onOpenSource: (source) {
              launchUrl(
                source.url,
                mode: LaunchMode.externalApplication,
              );
            },
          ),
        ),
      ),
    );
  }
}

class _NewsLoadError extends StatelessWidget {
  const _NewsLoadError({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 42),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => onRetry(),
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
