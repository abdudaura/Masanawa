import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../../core/providers.dart';
import '../../features/home_feed/feed_api.dart';
import '../../features/home_feed/feed_media_api.dart';
import '../../features/home_feed/feed_media_screen.dart';
import '../../features/home_feed/feed_screen.dart';
import '../../features/videos/video_models.dart';
import '../../features/videos/video_repository.dart';
import '../../features/videos/videos_screen.dart';
import '../../features/videos/official_video_player_screen.dart';
import '../../core/status_audio_focus.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';

/// Scope every Status operation to the signed-in fan who opened the tab.
/// The Gateway remains the authority for Masana eligibility and post visibility.
class AccountBoundFeedApi extends DioFeedApi {
  AccountBoundFeedApi({
    required superDio,
    required superToken,
    required this.ownerAccount,
    required this.currentAccount,
  }) : super(superDio, superToken);

  final String ownerAccount;
  final String? Function() currentAccount;

  Future<T> _checked<T>(Future<T> Function() work) async {
    if (ownerAccount.isEmpty || currentAccount() != ownerAccount) {
      throw StateError('account_changed');
    }
    final result = await work();
    if (currentAccount() != ownerAccount) {
      throw StateError('account_changed');
    }
    return result;
  }

  @override
  Future<FeedPage> list({required String mode, String? cursor}) =>
      _checked(() => super.list(mode: mode, cursor: cursor));
  @override
  Future<void> like(String id, bool enabled) =>
      _checked(() => super.like(id, enabled));
  @override
  Future<void> save(String id, bool enabled) =>
      _checked(() => super.save(id, enabled));
  @override
  Future<void> comment(String id, String body, String key) =>
      _checked(() => super.comment(id, body, key));
  @override
  Future<List<FeedComment>> comments(String id) =>
      _checked(() => super.comments(id));
  @override
  Future<FeedPost> detail(String id) =>
      _checked(() => super.detail(id));
  @override
  Future<List<FeedComment>> thread(String id, String sort) =>
      _checked(() => super.thread(id, sort));
  @override
  Future<void> sendThreadComment(
    String id, String body, String key, String? parentId,
  ) => _checked(() => super.sendThreadComment(id, body, key, parentId));
}

class AccountBoundFeedMediaApi implements FeedMediaApi {
  const AccountBoundFeedMediaApi({
    required this.delegate,
    required this.ownerAccount,
    required this.currentAccount,
  });
  final FeedMediaApi delegate;
  final String ownerAccount;
  final String? Function() currentAccount;

  @override
  Future<FeedMediaGrant> getGrant(String postId, String mediaId) async {
    if (ownerAccount.isEmpty || currentAccount() != ownerAccount) {
      throw StateError('account_changed');
    }
    final grant = await delegate.getGrant(postId, mediaId);
    if (currentAccount() != ownerAccount) {
      throw StateError('account_changed');
    }
    return grant;
  }
}

/// Tests can replace this provider with a synthetic feed. Production always
/// uses the existing authenticated ApiClient/Dio, never a second login.
final statusFeedApiProvider = Provider<FeedApi>((ref) {
  final session = ref.watch(sessionProvider);
  final client = ref.watch(apiClientProvider);
  final account = session is SessionSignedIn ? session.user.id : '';
  String? currentAccount() {
    try {
      final active = ref.read(sessionProvider);
      return active is SessionSignedIn ? active.user.id : null;
    } catch (_) {
      return null;
    }
  }

  return AccountBoundFeedApi(
    superDio: client.dio,
    superToken: () async => client.accessToken,
    ownerAccount: account,
    currentAccount: currentAccount,
  );
});

/// The video catalogue uses the *same* ApiClient auth interceptor as Status.
class AccountBoundVideoRepository extends VideoRepository {
  AccountBoundVideoRepository(Dio dio, {
    required this.ownerAccount,
    required this.currentAccount,
  }) : super(dio);

  final String ownerAccount;
  final String? Function() currentAccount;

  Future<T> _checked<T>(Future<T> Function() work) async {
    if (ownerAccount.isEmpty || currentAccount() != ownerAccount) {
      throw StateError('account_changed');
    }
    final value = await work();
    if (currentAccount() != ownerAccount) {
      throw StateError('account_changed');
    }
    return value;
  }

  @override
  Future<VideoCatalogPage> page({String? provider, String? before}) =>
      _checked(() => super.page(provider: provider, before: before));

  @override
  Future<bool> isApproved(String id) =>
      _checked(() => super.isApproved(id));
}

/// The Status root is for Masana-authored approved updates only. The former
/// Talk creation route is not a Status action and is deliberately absent.
class StatusScreen extends ConsumerWidget {
  const StatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session is! SessionSignedIn) {
      return Center(child: Text(
        'Sign in to view Status updates.',
        style: TextStyle(color: context.masanawa.textPrimary),
      ));
    }
    final account = session.user.id;
    final feed = ref.watch(statusFeedApiProvider);
    final api = ref.watch(apiClientProvider);
    String? currentAccount() {
      try {
        final active = ref.read(sessionProvider);
        return active is SessionSignedIn ? active.user.id : null;
      } catch (_) {
        return null;
      }
    }

    void openMedia(FeedPost post, String mediaId) {
      if (!const {'image', 'audio'}.contains(post.kind) ||
          currentAccount() != account) return;
      final media = AccountBoundFeedMediaApi(
        delegate: DioFeedMediaApi(api.dio, () async => api.accessToken),
        ownerAccount: account,
        currentAccount: currentAccount,
      );
      Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => Consumer(builder: (context, ref, _) {
          final active = ref.watch(sessionProvider);
          if (active is! SessionSignedIn || active.user.id != account) {
            return const Scaffold(
              body: Center(child: Text('Sign in to view this update.')),
            );
          }
          return FeedMediaScreen(
            key: ValueKey('status-${post.kind}-$account-${post.id}-$mediaId'),
            api: media,
            accountKey: account,
            postId: post.id,
            mediaIds: post.mediaIds,
            initialMediaId: mediaId,
            kind: post.kind,
            onBeforeAudio: post.kind == 'audio'
                ? () => StatusAudioFocus.prepare(
                    isAccountCurrent: () => currentAccount() == account)
                : null,
          );
        }),
      ));
    }

    final videos = AccountBoundVideoRepository(
      api.dio, ownerAccount: account, currentAccount: currentAccount,
    );

    void openApprovedVideo(ExternalVideo video) {
      if (currentAccount() != account) return;
      Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => Consumer(builder: (context, ref, _) {
          final active = ref.watch(sessionProvider);
          if (active is! SessionSignedIn || active.user.id != account) {
            return const Scaffold(
              body: Center(child: Text('Sign in to watch videos.')),
            );
          }
          return OfficialVideoPlayerScreen(
            key: ValueKey('status-video-$account-${video.id}'),
            video: video,
            checkAvailability: videos.isApproved,
          );
        }),
      ));
    }

    return KeyedSubtree(
      key: ValueKey('status-account-$account'),
      child: DefaultTabController(
        length: 2,
        child: Column(children: [
          const TabBar(tabs: [
            Tab(text: 'Updates', icon: Icon(Icons.article_outlined)),
            Tab(text: 'Videos', icon: Icon(Icons.ondemand_video_outlined)),
          ]),
          Expanded(child: TabBarView(children: [
            MasanaFeedScreen(
              api: feed,
              accountKey: account,
              onOpenMedia: openMedia,
              audioPlaybackAvailable: true,
            ),
            ExternalVideosScreen(
              accountKey: account,
              load: ({provider}) => videos.list(provider: provider),
              loadPage: ({provider, before}) => videos.page(
                provider: provider, before: before,
              ),
              checkAvailability: videos.isApproved,
              onOpenVideo: openApprovedVideo,
              languageCode: Localizations.localeOf(context).languageCode,
            ),
          ])),
        ]),
      ),
    );
  }
}
