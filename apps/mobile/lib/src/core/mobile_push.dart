import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/services.dart';

import '../agents/agent_shell.dart';
import 'request_id.dart';
import 'shell_deep_link.dart';
import 'private_push_preview.dart';

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
  static const _enabledKey = 'masanawa.push.enabled.v1';
  static final _links = StreamController<Uri>.broadcast(sync: true);
  static final _notifications = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;
  static bool _nativeLinksInitialized = false;
  static Future<void>? _initializing;
  static Uri? _initialLink;
  static const _nativeLinks = MethodChannel('masanawa/deep_links');
  static String? _installationId;
  static AgentShellTransport? _transport;
  static String? _characterId;
  static int _contextGeneration = 0;
  static StreamSubscription<String>? _tokenRefresh;
  static StreamSubscription<RemoteMessage>? _foreground;
  static StreamSubscription<RemoteMessage>? _opened;

  Stream<Uri> get deepLinks => _links.stream;
  bool get configured => firebasePushConfigured;

  Uri? takeInitialDeepLink() {
    final link = _initialLink;
    _initialLink = null;
    return link;
  }

  Future<void> initialize() async {
    if (_initialized) return;
    final active = _initializing;
    if (active != null) return active;
    final future = _initialize();
    _initializing = future;
    try {
      await future;
    } finally {
      _initializing = null;
    }
  }

  Future<void> _initialize() async {
    if (!_nativeLinksInitialized) {
      _nativeLinks.setMethodCallHandler((call) async {
        if (call.method == 'open' && call.arguments is String) {
          _emitLink(call.arguments as String);
        }
      });
      try {
        final raw = await _nativeLinks.invokeMethod<String>('initial');
        if (raw != null) _emitLink(raw);
      } on MissingPluginException {
        // Native URI bridge is Android-only.
      } on PlatformException {
        // Push navigation remains available independently.
      }
      _nativeLinksInitialized = true;
    }
    if (!firebasePushConfigured) return;
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

    // Create this user-controllable channel BEFORE the first background FCM
    // call hint arrives; Android would otherwise silently use a default
    // low-priority channel and fail to surface an incoming invitation.
    final android = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (android != null) {
      await android.createNotificationChannel(const AndroidNotificationChannel(
        'masanawa_private_calls',
        'Private calls',
        description: 'Incoming private person-to-person calls',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      ));
    }

    final launch = await _notifications.getNotificationAppLaunchDetails();
    final localPayload = launch?.notificationResponse?.payload;
    if (launch?.didNotificationLaunchApp == true && localPayload != null) {
      _emitLink(localPayload);
    }

    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) _emitMessageLink(initial);

    _foreground = FirebaseMessaging.onMessage.listen((message) async {
      final notification = message.notification;
      if (notification == null) return;
      // Provider display text can contain untrusted profile names, private
      // amounts or legacy payloads. Foreground OS banners must be generic.
      // Navigation still uses the separately validated typed deep-link path.
      final safePreview = privatePushPreview(message.data);
      final isIncomingHumanCall =
          message.data['type']=='human_private_call' &&
          message.data['eventType']=='ringing';
      await _notifications.show(
        id: message.messageId?.hashCode ?? DateTime.now().millisecondsSinceEpoch,
        title: safePreview.title,
        body: safePreview.body,
        notificationDetails: NotificationDetails(
          android: isIncomingHumanCall
              ? const AndroidNotificationDetails(
                  'masanawa_private_calls',
                  'Private calls',
                  channelDescription: 'Incoming one-to-one calls',
                  importance: Importance.max,
                  priority: Priority.max,
                  category: AndroidNotificationCategory.call,
                  visibility: NotificationVisibility.private,
                )
              : const AndroidNotificationDetails(
                  'masanawa_work',
                  'Masanawa updates',
                  channelDescription: 'Agent replies, approvals and completed work',
                  importance: Importance.high,
                  priority: Priority.high,
                ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: _linkFor(message),
      );
    });
    _opened = FirebaseMessaging.onMessageOpenedApp.listen(_emitMessageLink);
    _tokenRefresh = FirebaseMessaging.instance.onTokenRefresh.listen((_) {
      final transport = _transport;
      final characterId = _characterId;
      if (transport != null && characterId != null) {
        unawaited(registerForCharacter(transport, characterId).catchError((_) {}));
      }
    });
    _initialized = true;
  }

  Future<bool> notificationEnabled() async {
    if (!firebasePushConfigured) return false;
    await initialize();
    if (await _storage.read(key: _enabledKey) == 'false') return false;
    final settings = await FirebaseMessaging.instance.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
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
    final allowed = settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
    await _storage.write(key: _enabledKey, value: allowed ? 'true' : 'false');
    final transport = _transport;
    final characterId = _characterId;
    if (allowed && transport != null && characterId != null) {
      await registerForCharacter(transport, characterId).catchError((_) {});
    }
    return allowed;
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
    _transport = transport;
    _characterId = characterId;
    final generation = ++_contextGeneration;
    await initialize();
    if (generation != _contextGeneration) return;
    if (await _storage.read(key: _enabledKey) == 'false') return;
    final settings = await FirebaseMessaging.instance.getNotificationSettings();
    if (settings.authorizationStatus != AuthorizationStatus.authorized &&
        settings.authorizationStatus != AuthorizationStatus.provisional) return;
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null || token.isEmpty) return;
    final installationId = await _installation();
    if (generation != _contextGeneration) return;
    await transport.registerPush(
      characterId: characterId,
      installationId: installationId,
      platform: Platform.isIOS ? 'ios' : 'android',
      token: token,
    );
  }

  Future<void> unregister() async {
    final transport = _transport;
    final characterId = _characterId;
    ++_contextGeneration;
    _transport = null;
    _characterId = null;
    _initialLink = null;
    await _storage.write(key: _enabledKey, value: 'false');
    if (transport != null && characterId != null) {
      try {
        await transport.unregisterPush(
          characterId: characterId,
          installationId: await _installation(),
        );
      } catch (_) {}
    }
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }

  void _emitMessageLink(RemoteMessage message) {
    final link = _linkFor(message);
    if (link != null) _emitLink(link);
  }

  String? _linkFor(RemoteMessage message) {
    // A push contains only an opaque ID; the protected call route fetches
    // current server admission before offering Answer, and no microphone
    // starts from push receipt or navigation.
    if (message.data['type'] == 'human_private_call') {
      final id = message.data['callId'];
      if (id is String && RegExp(
        r'^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}
    if (explicit is String && explicit.isNotEmpty) return explicit;
    final characterId = message.data['characterId'];
    if (characterId is String && characterId.startsWith('character_')) {
      return 'masanawa://chat/${Uri.encodeComponent(characterId)}';
    }
    return null;
  }

  void _emitLink(String raw) {
    final uri = Uri.tryParse(raw);
    if (uri == null || shellDeepLinkRoute(uri) == null) return;
    if (_links.hasListener) {
      _links.add(uri);
    } else {
      _initialLink = uri;
    }
  }

  Future<void> dispose() async {
    await _tokenRefresh?.cancel();
    await _foreground?.cancel();
    await _opened?.cancel();
    _tokenRefresh = null;
    _foreground = null;
    _opened = null;
    _initialized = false;
  }
}

,
      ).hasMatch(id)) {
        return 'masanawa://calls/${Uri.encodeComponent(id)}';
      }
      return null;
    }
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
    if (uri == null || shellDeepLinkRoute(uri) == null) return;
    if (_links.hasListener) {
      _links.add(uri);
    } else {
      _initialLink = uri;
    }
  }

  Future<void> dispose() async {
    await _tokenRefresh?.cancel();
    await _foreground?.cancel();
    await _opened?.cancel();
    _tokenRefresh = null;
    _foreground = null;
    _opened = null;
    _initialized = false;
  }
}

