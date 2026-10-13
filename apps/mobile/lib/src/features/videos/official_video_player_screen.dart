import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'video_models.dart';
import 'video_embed_policy.dart';

typedef VideoEmbedBuilder = Widget Function(Uri embedUrl);
typedef ExternalVideoOpener = Future<bool> Function(Uri url);

/// C28/C29: the provider's real embedded player, never downloaded MP4.
class OfficialVideoPlayerScreen extends StatefulWidget {
  const OfficialVideoPlayerScreen({
    required this.video, this.embedBuilder, this.open,
    this.checkAvailability,
    this.languageCode = 'en', super.key,
  });
  final ExternalVideo video;
  final VideoEmbedBuilder? embedBuilder;
  final ExternalVideoOpener? open;
  /// A current server approval check (not a locally cached catalog bit).
  /// Optional only until AF00 composes the canonical signed-in repository.
  final Future<bool> Function(String id)? checkAvailability;
  final String languageCode;
  @override State<OfficialVideoPlayerScreen> createState() =>
      _OfficialVideoPlayerScreenState();
}

class _OfficialVideoPlayerScreenState extends State<OfficialVideoPlayerScreen>
    with WidgetsBindingObserver {
  WebViewController? controller;
  bool playing = false, loading = false, unavailable = false, opening = false;
  bool allowInitialHtmlNavigation = false;
  bool checkingAvailability = false, verificationFailed = false;
  int availabilityEpoch = 0;
  late OfficialVideoEmbed? approvedEmbed;

  String t(String en, String ha) =>
      widget.languageCode == 'ha' ? ha : en;

  @override void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    verificationFailed = widget.checkAvailability == null;
    try {
      approvedEmbed = OfficialVideoEmbed.fromSource(
        widget.video.provider, widget.video.sourceUrl);
    } on FormatException {
      approvedEmbed = null;
      unavailable = true;
    }
  }

  @override void didUpdateWidget(covariant OfficialVideoPlayerScreen old) {
    super.didUpdateWidget(old);
    if (old.video.id != widget.video.id ||
        old.video.sourceUrl != widget.video.sourceUrl ||
        old.checkAvailability != widget.checkAvailability) {
      availabilityEpoch++;
      checkingAvailability = false;
      verificationFailed = widget.checkAvailability == null;
      controller = null;
      playing = false;
      loading = false;
      unavailable = false;
      try {
        approvedEmbed = OfficialVideoEmbed.fromSource(
          widget.video.provider, widget.video.sourceUrl);
      } on FormatException {
        approvedEmbed = null;
        unavailable = true;
      }
    }
  }

  @override void didChangeAppLifecycleState(AppLifecycleState state) {
    // Discard the player on app background/calls; it must never keep audio alive.
    if (state != AppLifecycleState.resumed && mounted) {
      availabilityEpoch++;
      setState(() {
        playing = false; controller = null; loading = false;
        checkingAvailability = false;
      });
    }
  }

  void play() {
    if (approvedEmbed == null || unavailable || checkingAvailability || playing) return;
    final check = widget.checkAvailability;
    if (check == null) {
      // The host must inject the signed-in server authorization resolver.
      // A missing resolver can never authorize provider playback.
      setState(() => verificationFailed = true);
      return;
    }
    unawaited(_verifyAndPlay(check));
  }

  Future<void> _verifyAndPlay(Future<bool> Function(String) check) async {
    final epoch = ++availabilityEpoch;
    setState(() { checkingAvailability = true; verificationFailed = false; });
    bool available;
    try {
      available = await check(widget.video.id);
    } catch (_) {
      if (!mounted || epoch != availabilityEpoch) return;
      setState(() { checkingAvailability = false; verificationFailed = true; });
      return;
    }
    if (!mounted || epoch != availabilityEpoch) return;
    setState(() { checkingAvailability = false; unavailable = !available; });
    if (available) _startVerifiedPlayer();
  }

  void _startVerifiedPlayer() {
    final embed = approvedEmbed;
    if (embed == null || unavailable) return;
    if (kIsWeb && widget.embedBuilder == null) {
      unawaited(openAtSource());
      return;
    }
    if (widget.embedBuilder != null) {
      setState(() { playing = true; loading = false; });
      return;
    }
    setState(() { loading = true; playing = true; });
    allowInitialHtmlNavigation = true;
    final web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: (navigation) {
          // Never navigate the top-level WebView to arbitrary untrusted links.
          // The provider iframe owns its controls, logo and third-party JS.
          if (navigation.isMainFrame &&
              navigation.url.startsWith('data:text/html') &&
              allowInitialHtmlNavigation) {
            // loadHtmlString may use a data: top frame on Android. Only the
            // first locally generated document is permitted; provider-triggered
            // later top-level data: redirects must not be admitted.
            allowInitialHtmlNavigation = false;
            return NavigationDecision.navigate;
          }
          if (!navigation.isMainFrame ||
              navigation.url == 'about:blank' ||
              navigation.url == 'https://masanawa.com/') {
            return NavigationDecision.navigate;
          }
          unawaited(openAtSource());
          return NavigationDecision.prevent;
        },
        onPageFinished: (_) {
          allowInitialHtmlNavigation = false;
          if (mounted) setState(() => loading = false);
        },
        onWebResourceError: (error) {
          if (error.isForMainFrame != false && mounted) {
            setState(() {
              unavailable = true;
              playing = false;
              controller = null;
              loading = false;
            });
          }
        },
      ));
    controller = web;
    unawaited(web.loadHtmlString(
      embed.html(title: widget.video.title),
      // YouTube requires an identifiable referring origin (error 153).
      baseUrl: 'https://masanawa.com/',
    ).catchError((Object _) {
      if (mounted) {
        setState(() {
          unavailable = true;
          playing = false;
          controller = null;
          loading = false;
        });
      }
    }));
  }

  /// External provider navigation is a playback action too: never bypass
  /// the current server's approval merely because the old catalog had a URL.
  Future<void> openAtSource() async {
    if (opening || approvedEmbed == null) return;
    final verify = widget.checkAvailability;
    if (verify == null) {
      setState(() => verificationFailed = true);
      return;
    }
    final epoch = ++availabilityEpoch;
    setState(() { opening = true; verificationFailed = false; });
    bool authorized;
    try {
      authorized = await verify(widget.video.id);
    } catch (_) {
      if (mounted && epoch == availabilityEpoch) {
        setState(() { opening = false; verificationFailed = true; });
      }
      return;
    }
    if (!mounted || epoch != availabilityEpoch) return;
    if (!authorized) {
      setState(() {
        opening = false;
        unavailable = true;
        playing = false;
        controller = null;
        loading = false;
      });
      return;
    }
    bool result = false;
    try {
      result = await (widget.open?.call(approvedEmbed!.source) ??
          launchUrl(approvedEmbed!.source, mode: LaunchMode.externalApplication));
    } catch (_) {
      result = false;
    }
    if (!mounted || epoch != availabilityEpoch) return;
    setState(() { opening = false; if (!result) unavailable = true; });
    if (!result) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(t('Could not open the provider app.',
          'Ba a iya bude manhajar asali ba.')),
      ));
    }
  }

  @override void dispose() {
    availabilityEpoch++;
    WidgetsBinding.instance.removeObserver(this);
    controller = null;
    super.dispose();
  }

  @override Widget build(BuildContext context) {
    final embed = approvedEmbed;
    return Scaffold(
      appBar: AppBar(title: Text(widget.video.provider)),
      body: SafeArea(child: ListView(children: [
        AspectRatio(aspectRatio: 16 / 9, child: ColoredBox(
          color: Colors.black,
          child: unavailable || embed == null || verificationFailed
            ? Center(child: Text(unavailable || embed == null
                ? t('Video unavailable here. Open at source.',
                    'Ba a samun bidiyon nan. Bude daga asali.')
                : t('Could not check video availability. Retry when online.',
                    'Ba a iya tabbatar da bidiyo ba. Sake gwadawa idan akwai intanet.'),
                style: const TextStyle(color: Colors.white)))
            : !playing
              ? Center(child: FilledButton.icon(
                  onPressed: checkingAvailability ? null : play,
                  icon: const Icon(Icons.play_arrow),
                  label: Text(checkingAvailability
                    ? t('Checking availability…', 'Ana duba samuwar bidiyo…')
                    : t('Play official video', 'Kunna bidiyon asali'))))
              : Stack(children: [
                  Positioned.fill(child: widget.embedBuilder?.call(embed.embed) ??
                      (controller == null ? const SizedBox.shrink()
                        : WebViewWidget(controller: controller!))),
                  if (loading) const Center(child: CircularProgressIndicator()),
                ]),
        )),
        Padding(padding: const EdgeInsets.all(16), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.video.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text('${widget.video.channelName} · ${widget.video.provider}',
            style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          Text(t('This video is hosted by its original provider. Its controls, '
            'branding and ads are managed there.',
            'Mai bidiyon ne ke daukar nauyinsa tare da alamarsa da dokokinsa.')),
          const SizedBox(height: 12),
          Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton.icon(
              onPressed: opening || embed == null ? null : openAtSource,
              icon: const Icon(Icons.open_in_new),
              label: Text(t('Open in ${widget.video.provider}',
                'Bude a ${widget.video.provider}')),
            ),
            if (playing) TextButton.icon(
              onPressed: () => setState(() {
                playing = false; controller = null; loading = false;
              }),
              icon: const Icon(Icons.stop_circle_outlined),
              label: Text(t('Stop', 'Dakatar'))),
            if (unavailable || verificationFailed) TextButton.icon(
              onPressed: () => setState(() {
                unavailable = embed == null;
                verificationFailed = false;
                loading = false;
              }),
              icon: const Icon(Icons.refresh), label: Text(t('Retry', 'Sake gwadawa'))),
          ]),
        ])),
      ])),
    );
  }
}
