import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../features/home_feed/feed_api.dart';
import '../../features/home_feed/feed_media_api.dart';
import '../../features/home_feed/feed_media_screen.dart';
import '../../features/home_feed/feed_screen.dart';
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

    void openImage(FeedPost post, String mediaId) {
      if (post.kind != 'image' || currentAccount() != account) return;
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
            key: ValueKey('status-image-$account-${post.id}-$mediaId'),
            api: media,
            accountKey: account,
            postId: post.id,
            mediaIds: post.mediaIds,
            initialMediaId: mediaId,
            kind: 'image',
          );
        }),
      ));
    }

    return KeyedSubtree(
      key: ValueKey('status-account-$account'),
      child: MasanaFeedScreen(
        api: feed,
        accountKey: account,
        onOpenMedia: openImage,
        // No supplied author-public-profile route or signed audio-focus
        // contract in this shell. Leave those actions unmounted, not guessed.
        audioPlaybackAvailable: false,
      ),
    );
  }
}
