import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../agents/agent_shell.dart';
import 'request_id.dart';

const _firebaseApiKey =
    String.fromEnvironment('FIREBASE_API_KEY', defaultValue: '');
const _firebaseAppId =
    String.fromEnvironment('FIREBASE_APP_ID', defaultValue: '');
const _firebaseSenderId =
    String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID', defaultValue: '');
const _firebaseProjectId =
    String.fromEnvironment('FIREBASE_PROJECT_ID', defaultValue: '');

bool get firebasePushConfigured =>
    _firebaseApiKey.isNotEmpty &&
    _firebaseAppId.isNotEmpty &&
    _firebaseSenderId.isNotEmpty &&
    _firebaseProjectId.isNotEmpty;

FirebaseOptions get _firebaseOptions => const FirebaseOptions(
      apiKey: _firebaseApiKey,
      appId: _firebaseAppId,
      messagingSenderId: _firebaseSenderId,
      projectId: _firebaseProjectId,
    );

@pragma('vm:entry-point')
Future<void> masanawaFirebaseBackgroundMessage(RemoteMessage message) async {
  if (!firebasePushConfigured) return;
  await Firebase.initializeApp(options: _firebaseOptions);
}

class MobilePushService {
  MobilePushService._();

  static final instance = MobilePushService._();
  static const _storage = FlutterSecureStorage();
  static const _installationKey = 'masanawa.push.installation.v1';
  static final _links = StreamController<Uri>.broadcast(sync: true);
  static final _notifications = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;
  static String? _installationId;
  static AgentShellTransport? _transport;
  static String? _characterId;
  static StreamSubscription<String>? _tokenRefresh;
  static StreamSubscription<RemoteMessage>? _foreground;
  static StreamSubscription<RemoteMessage>? _opened;

  Stream<Uri> get deepLinks => _links.stream;
  bool get configured => firebasePushConfigured;

  Future<void> initialize() async {
    if (_initialized || !firebasePushConfigured) return;
    await Firebase.initializeApp(options: _firebaseOptions);
    FirebaseMessaging.onBackgroundMessage(masanawaFirebaseBackgroundMessage);

    await _notifications.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload != null) _emitLink(payload);
      },
    );

    final launch = await _notifications.getNotificationAppLaunchDetails();
    final localPayload = launch?.notificationResponse?.payload;
    if (launch?.didNotificationLaunchApp == true && localPayload != null) {
      scheduleMicrotask(() => _emitLink(localPayload));
    }

    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) scheduleMicrotask(() => _emitMessageLink(initial));

    _foreground = FirebaseMessaging.onMessage.listen((message) async {
      _emitMessageLink(message);
      final notification = message.notification;
      if (notification == null) return;
      await _notifications.show(
        id: message.messageId?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
        title: notification.title ?? 'Masanawa',
        body: notification.body,
        notificationDetails: const NotificationDetails(
          android: AndroidNotificationDetails(
            'masanawa_work',
            'Masanawa updates',
            channelDescription: 'Agent replies, approvals and completed work',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
        payload: _linkFor(message),
      );
    });
    _opened = FirebaseMessaging.onMessageOpenedApp.listen(_emitMessageLink);
    _tokenRefresh = FirebaseMessaging.instance.onTokenRefresh.listen((_) {
      final transport = _transport;
      final characterId = _characterId;
      if (transport != null && characterId != null) {
        unawaited(registerForCharacter(transport, characterId));
      }
    });
    _initialized = true;
  }

  Future<bool> requestPermission() async {
    if (!firebasePushConfigured) return false;
    await initialize();
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    final android = _notifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (android != null) {
      await android.requestNotificationsPermission();
    }
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  Future<String> _installation() async {
    final cached = _installationId ?? await _storage.read(key: _installationKey);
    if (cached != null && cached.length >= 16) {
      _installationId = cached;
      return cached;
    }
    final created = createRequestId().replaceFirst('request_', 'install_');
    await _storage.write(key: _installationKey, value: created);
    _installationId = created;
    return created;
  }

  Future<void> registerForCharacter(
    AgentShellTransport transport,
    String characterId,
  ) async {
    if (!firebasePushConfigured) return;
    await initialize();
    _transport = transport;
    _characterId = characterId;
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) return;
    await transport.registerPush(
      characterId: characterId,
      installationId: await _installation(),
      platform: Platform.isIOS ? 'ios' : 'android',
      token: token,
    );
  }

  Future<void> unregister() async {
    final transport = _transport;
    final characterId = _characterId;
    if (transport != null && characterId != null) {
      try {
        await transport.unregisterPush(
          characterId: characterId,
          installationId: await _installation(),
        );
      } catch (_) {}
    }
    _transport = null;
    _characterId = null;
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }

  void _emitMessageLink(RemoteMessage message) {
    final link = _linkFor(message);
    if (link != null) _emitLink(link);
  }

  String? _linkFor(RemoteMessage message) {
    final explicit = message.data['deepLink'];
    if (explicit is String && explicit.isNotEmpty) return explicit;
    final characterId = message.data['characterId'];
    if (characterId is String && characterId.startsWith('character_')) {
      return 'masanawa://chat/${Uri.encodeComponent(characterId)}';
    }
    return null;
  }

  void _emitLink(String raw) {
    final uri = Uri.tryParse(raw);
    if (uri == null || uri.scheme != 'masanawa') return;
    if (!{'chat', 'work', 'approval', 'artifact'}.contains(uri.host)) return;
    _links.add(uri);
  }

  Future<void> dispose() async {
    await _tokenRefresh?.cancel();
    await _foreground?.cancel();
    await _opened?.cancel();
  }
}
