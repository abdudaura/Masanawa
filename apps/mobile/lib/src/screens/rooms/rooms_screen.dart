import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../features/rooms/room_discussion_api.dart';
import '../../features/rooms/rooms_client.dart';
import '../../features/rooms/rooms_screen.dart' as canonical;
import '../../features/rooms/saved_lessons_client.dart';
import '../../state/session_state.dart';
import '../../theme/masanawa_theme.dart';

/// Reuses the existing authenticated Gateway Dio and the canonical J07 Rooms
/// contract. Never use the retired Talk/live-feed endpoint as Room discovery.
final roomsClientProvider = Provider<RoomsClient>((ref) =>
    HttpRoomsClient(ref.watch(apiClientProvider).dio));

class AccountBoundRoomsClient implements RoomsClient {
  AccountBoundRoomsClient({
    required this.delegate,
    required this.ownerAccount,
    required this.currentAccount,
  });

  final RoomsClient delegate;
  final String ownerAccount;
  final String? Function() currentAccount;

  void _checkAccount() {
    if (ownerAccount.isEmpty || currentAccount() != ownerAccount) {
      throw StateError('account_changed');
    }
  }

  Future<T> _guard<T>(Future<T> Function() work) async {
    _checkAccount();
    final value = await work();
    _checkAccount();
    return value;
  }

  @override
  Future<List<RoomInfo>> list({
    required bool joined,
    String query = '',
    String language = '',
  }) => _guard(() => delegate.list(
      joined: joined, query: query, language: language));

  @override
  Future<RoomInfo> room(String id) => _guard(() => delegate.room(id));

  @override
  Future<void> join(String id) => _guard(() => delegate.join(id));

  @override
  Future<void> leave(String id) => _guard(() => delegate.leave(id));

  @override
  Future<RoomQuestion> ask(String id, String text, String key) =>
      _guard(() => delegate.ask(id, text, key));

  @override
  Future<List<RoomQuestion>> questions(String id) =>
      _guard(() => delegate.questions(id));

  @override
  Future<List<RoomLesson>> lessons(String id) =>
      _guard(() => delegate.lessons(id));
}

class AccountBoundRoomDiscussionApi implements RoomDiscussionApi {
  const AccountBoundRoomDiscussionApi({
    required this.delegate,
    required this.ownerAccount,
    required this.currentAccount,
  });
  final RoomDiscussionApi delegate;
  final String ownerAccount;
  final String? Function() currentAccount;

  Future<T> _guard<T>(Future<T> Function() work) async {
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
  Future<List<RoomDiscussionTarget>> targets(String roomId) =>
      _guard(() => delegate.targets(roomId));

  @override
  Future<RoomDiscussionPage> list(
    String roomId,
    RoomDiscussionTarget target, {
    String? cursor,
  }) => _guard(() => delegate.list(roomId, target, cursor: cursor));

  @override
  Future<RoomDiscussionReply> send(
    String roomId,
    RoomDiscussionTarget target,
    String body,
    String key, {
    String? parentReplyId,
  }) => _guard(() => delegate.send(
      roomId, target, body, key, parentReplyId: parentReplyId));
}

/// Already mounted in the five-tab shell; deliberately owns no new router,
/// server identity, payment rail or migration. Missing server routes render
/// an unavailable/retry state rather than invented Room records.
class RoomsScreen extends ConsumerWidget {
  const RoomsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (session is! SessionSignedIn) {
      return Scaffold(
        backgroundColor: context.masanawa.surfaceBg,
        body: const Center(
          child: Text('Sign in to view your Rooms.'),
        ),
      );
    }

    final ownerAccount = session.user.id;
    final api = ref.watch(apiClientProvider);
    String? currentAccount() {
      // A disposed tab must fail closed rather than retaining another fan's
      // data in an in-flight read, even after logout or account replacement.
      try {
        final current = ref.read(sessionProvider);
        return current is SessionSignedIn ? current.user.id : null;
      } catch (_) {
        return null;
      }
    }

    return KeyedSubtree(
      key: ValueKey('rooms-account-' + ownerAccount),
      child: canonical.RoomsScreen(
        client: AccountBoundRoomsClient(
          delegate: ref.watch(roomsClientProvider),
          ownerAccount: ownerAccount,
          currentAccount: currentAccount,
        ),
        discussionApi: AccountBoundRoomDiscussionApi(
          delegate: HttpRoomDiscussionApi(api.dio),
          ownerAccount: ownerAccount,
          currentAccount: currentAccount,
        ),
        discussionAccountScope: ownerAccount,
        savedLessonsClient: DioSavedLessonsClient(
          dio: api.dio,
          accountKey: ownerAccount,
          currentAccountKey: currentAccount,
        ),
        savedLessonsAccountKey: ownerAccount,
      ),
    );
  }
}
