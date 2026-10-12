import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/talk_state.dart';
import '../../talks/talk_models.dart';
import '../../theme/masanawa_theme.dart';
import '../../ui/components/masanawa_main_header.dart';

/// Live audio rooms, backed by the live Talk feed. A room here is a live
/// voice session you can join; history and membership controls arrive in the
/// follow-up unit.
class RoomsScreen extends ConsumerWidget {
  const RoomsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = context.masanawa;
    final feed = ref.watch(talkFeedProvider(TalkFeedKind.live));
    return Scaffold(
      backgroundColor: u.surfaceBg,
      appBar: masanawaMainHeader(context),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(talkFeedProvider(TalkFeedKind.live).future),
        child: feed.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(Icons.cloud_off_outlined, size: 52, color: u.brand),
                    const SizedBox(height: 16),
                    Text(
                      'Could not load rooms. Pull to try again.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: u.textMuted, fontSize: 14, height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
          data: (rooms) {
            final live = rooms.where((r) => r.isLive).toList(growable: false);
            if (live.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      children: [
                        Icon(Icons.groups_outlined, size: 58, color: u.brand),
                        const SizedBox(height: 18),
                        Text(
                          'No live rooms',
                          style: TextStyle(
                            color: u.textPrimary,
                            fontSize: 19,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Live voice rooms will appear here.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                              color: u.textMuted, fontSize: 14, height: 1.5),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }
            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: live.length,
              separatorBuilder: (_, __) =>
                  Divider(height: 1, indent: 76, color: u.structuralBorder),
              itemBuilder: (context, index) {
                final room = live[index];
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  leading: Stack(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: u.brand,
                        foregroundImage:
                            room.hostAvatarUrl?.isNotEmpty == true
                                ? NetworkImage(room.hostAvatarUrl!)
                                : null,
                        child: room.hostAvatarUrl?.isNotEmpty == true
                            ? null
                            : Text(
                                room.hostName.isNotEmpty
                                    ? room.hostName[0].toUpperCase()
                                    : '?',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 20,
                                ),
                              ),
                      ),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 1,
                          ),
                          decoration: BoxDecoration(
                            color: u.success,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: u.surfaceBg, width: 2),
                          ),
                          child: const Text(
                            'LIVE',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  title: Text(
                    room.title.isNotEmpty ? room.title : 'Live room',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: u.textPrimary,
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      '${room.hostName} · ${room.listenerCount} listening',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: u.textMuted, fontSize: 14),
                    ),
                  ),
                  trailing: Icon(
                    Icons.chevron_right_rounded,
                    color: u.textMuted,
                  ),
                  onTap: () => context.push(
                    '/talk/' + Uri.encodeComponent(room.id),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
