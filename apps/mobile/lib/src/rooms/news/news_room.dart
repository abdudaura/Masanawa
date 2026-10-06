import 'package:flutter/material.dart';

import '../../theme/masanawa_theme.dart';
import 'news_models.dart';

typedef NewsItemCallback = void Function(NewsItem item);
typedef NewsCategoryCallback = void Function(String? categoryId);

/// Isolated News Room presentation.
///
/// Navigation, transport and acquisition are intentionally injected so this widget
/// can be composed by #136 without owning shared app routing or runtime authority.
class NewsRoomView extends StatefulWidget {
  const NewsRoomView({
    super.key,
    required this.projection,
    this.onOpenItem,
    this.onCategoryChanged,
    this.onPlayAudio,
  });

  final NewsRoomProjection projection;
  final NewsItemCallback? onOpenItem;
  final NewsCategoryCallback? onCategoryChanged;
  final NewsItemCallback? onPlayAudio;

  @override
  State<NewsRoomView> createState() => _NewsRoomViewState();
}

class _NewsRoomViewState extends State<NewsRoomView> {
  String? _categoryId;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    final projection = widget.projection;
    final items = projection.itemsForCategory(_categoryId);
    final featured =
        _categoryId == null ? projection.featuredItem : null;

    return ColoredBox(
      color: colors.surfaceBg,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
        children: [
          Text(
            'News',
            style: TextStyle(
              color: colors.textPrimary,
              fontSize: 26,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Current stories with visible sources.',
            style: TextStyle(color: colors.textMuted),
          ),
          if (projection.categories.isNotEmpty) ...[
            const SizedBox(height: 16),
            SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _CategoryChip(
                    label: 'All',
                    selected: _categoryId == null,
                    onTap: () => _selectCategory(null),
                  ),
                  for (final category in projection.categories)
                    _CategoryChip(
                      label: category.label,
                      selected: _categoryId == category.id,
                      onTap: () => _selectCategory(category.id),
                    ),
                ],
              ),
            ),
          ],
          if (featured != null) ...[
            const SizedBox(height: 18),
            _FeaturedNewsCard(
              item: featured,
              onOpen: () => widget.onOpenItem?.call(featured),
              onPlayAudio: featured.audio == null
                  ? null
                  : () => widget.onPlayAudio?.call(featured),
            ),
          ],
          const SizedBox(height: 18),
          if (items.isEmpty)
            _EmptyNewsState(categorySelected: _categoryId != null)
          else
            for (final item in items)
              if (featured?.id != item.id)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: NewsItemCard(
                    item: item,
                    onOpen: () => widget.onOpenItem?.call(item),
                    onPlayAudio: item.audio == null
                        ? null
                        : () => widget.onPlayAudio?.call(item),
                  ),
                ),
        ],
      ),
    );
  }

  void _selectCategory(String? id) {
    setState(() => _categoryId = id);
    widget.onCategoryChanged?.call(id);
  }
}

class NewsItemCard extends StatelessWidget {
  const NewsItemCard({
    super.key,
    required this.item,
    required this.onOpen,
    this.onPlayAudio,
  });

  final NewsItem item;
  final VoidCallback onOpen;
  final VoidCallback? onPlayAudio;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Material(
      color: colors.surfaceCard,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onOpen,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.structuralBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      item.title,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 16,
                        height: 1.25,
                        fontWeight: FontWeight.w650,
                      ),
                    ),
                  ),
                  if (item.pinned)
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: Icon(
                        Icons.push_pin_outlined,
                        size: 17,
                        color: colors.brand,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 7),
              Text(
                item.summary,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: colors.textMuted,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.link, size: 14, color: colors.textMuted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      _sourceSummary(item),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  if (onPlayAudio != null)
                    IconButton(
                      tooltip: 'Listen',
                      visualDensity: VisualDensity.compact,
                      onPressed: onPlayAudio,
                      icon: Icon(
                        Icons.volume_up_outlined,
                        color: colors.brand,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class NewsArticleView extends StatelessWidget {
  const NewsArticleView({
    super.key,
    required this.item,
    this.onPlayAudio,
    this.onOpenSource,
  });

  final NewsItem item;
  final VoidCallback? onPlayAudio;
  final void Function(NewsSource source)? onOpenSource;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 32),
      children: [
        Text(
          item.title,
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: 25,
            height: 1.18,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          item.summary,
          style: TextStyle(
            color: colors.textMuted,
            fontSize: 15,
            height: 1.45,
          ),
        ),
        if (item.audio != null && onPlayAudio != null) ...[
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: onPlayAudio,
            icon: const Icon(Icons.headphones_outlined),
            label: const Text('Listen'),
          ),
        ],
        const SizedBox(height: 20),
        SelectableText(
          item.body,
          style: TextStyle(
            color: colors.textPrimary,
            fontSize: 16,
            height: 1.55,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Sources',
          style: TextStyle(
            color: colors.textPrimary,
            fontWeight: FontWeight.w650,
          ),
        ),
        const SizedBox(height: 8),
        for (final source in item.sources)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.open_in_new, size: 19),
            title: Text(source.label),
            subtitle: Text(source.url.host),
            onTap:
                onOpenSource == null ? null : () => onOpenSource!(source),
          ),
      ],
    );
  }
}

class _FeaturedNewsCard extends StatelessWidget {
  const _FeaturedNewsCard({
    required this.item,
    required this.onOpen,
    this.onPlayAudio,
  });

  final NewsItem item;
  final VoidCallback onOpen;
  final VoidCallback? onPlayAudio;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Material(
      color: colors.brand.withValues(alpha: .09),
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Top story',
                style: TextStyle(
                  color: colors.brand,
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                item.title,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 20,
                  height: 1.22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                item.summary,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: colors.textMuted, height: 1.4),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _sourceSummary(item),
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  if (onPlayAudio != null)
                    IconButton(
                      tooltip: 'Listen',
                      onPressed: onPlayAudio,
                      icon: Icon(
                        Icons.volume_up_outlined,
                        color: colors.brand,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => onTap(),
      ),
    );
  }
}

class _EmptyNewsState extends StatelessWidget {
  const _EmptyNewsState({required this.categorySelected});

  final bool categorySelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.masanawa;
    return Padding(
      padding: const EdgeInsets.only(top: 48),
      child: Column(
        children: [
          Icon(Icons.newspaper_outlined, size: 40, color: colors.textMuted),
          const SizedBox(height: 10),
          Text(
            categorySelected
                ? 'No sourced stories in this category yet.'
                : 'No sourced stories are available yet.',
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textMuted),
          ),
        ],
      ),
    );
  }
}

String _sourceSummary(NewsItem item) {
  if (item.sources.length == 1) {
    return item.sources.first.publisher ?? item.sources.first.url.host;
  }
  return '${item.sources.first.publisher ?? item.sources.first.url.host} +${item.sources.length - 1} sources';
}
