import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/features/videos/video_embed_policy.dart';
import 'package:masanawa/src/features/videos/video_models.dart';
import 'package:masanawa/src/features/videos/official_video_player_screen.dart';

void main() {
  test('canonical URLs are the only playable embeds', () {
    final yt = OfficialVideoEmbed.fromSource('youtube',
      Uri.parse('https://www.youtube.com/watch?v=abcDE12_-34'));
    expect(yt.embed.host, 'www.youtube.com');
    expect(yt.embed.path, '/embed/abcDE12_-34');
    expect(yt.html(title: '<artist>').contains('&lt;artist&gt;'), isTrue);
    final tk = OfficialVideoEmbed.fromSource('tiktok',
      Uri.parse('https://www.tiktok.com/@teacher/video/6718335390845095173'));
    expect(tk.embed.path, '/player/v1/6718335390845095173');
    final fb = OfficialVideoEmbed.fromSource('facebook',
      Uri.parse('https://www.facebook.com/watch/?v=123456789'));
    expect(fb.embed.path, '/plugins/video.php');
    expect(fb.embed.queryParameters['href'],
      'https://www.facebook.com/watch/?v=123456789');

    for (final raw in [
      'http://www.youtube.com/watch?v=abcDE12_-34',
      'https://www.youtube.com.evil.com/watch?v=abcDE12_-34',
      'https://www.youtube.com/watch?v=abcDE12_-34&redirect=https://bad.test',
      'https://www.youtube.com:444/watch?v=abcDE12_-34',
      'https://www.youtube.com/watch?v=abcDE12_-34#evil',
      'https://www.tiktok.com/@teacher/video/123',
      'https://www.facebook.com/plugins/video.php?href=https://bad.test',
    ]) {
      expect(() => OfficialVideoEmbed.fromSource(
        raw.contains('tiktok') ? 'tiktok' : raw.contains('facebook')
          ? 'facebook' : 'youtube', Uri.parse(raw)), throwsFormatException);
    }
  });

  testWidgets('official player, attribution, stop, external source and retry',
      (tester) async {
    final v = ExternalVideo(id: '1', title: 'Maths', channelName: 'Tutor',
      provider: 'youtube',
      sourceUrl: Uri.parse('https://www.youtube.com/watch?v=abcDE12_-34'));
    Uri? embedded, opened;
    await tester.pumpWidget(MaterialApp(home: OfficialVideoPlayerScreen(
      video: v,
      checkAvailability: (_) async => true,
      embedBuilder: (url) { embedded = url; return const Text('Provider iframe'); },
      open: (url) async { opened = url; return true; },
    )));
    expect(find.text('Maths'), findsOneWidget);
    expect(find.text('Tutor · youtube'), findsOneWidget);
    await tester.tap(find.text('Play official video'));
    await tester.pump();
    expect(embedded?.path, '/embed/abcDE12_-34');
    expect(find.text('Provider iframe'), findsOneWidget);
    await tester.ensureVisible(find.text('Stop'));
    await tester.pump();
    await tester.tap(find.text('Stop'));
    await tester.pump();
    expect(find.text('Provider iframe'), findsNothing);
    await tester.ensureVisible(find.text('Open in youtube'));
    await tester.pump();
    await tester.tap(find.text('Open in youtube'));
    await tester.pump();
    expect(opened, v.sourceUrl);
  });

  testWidgets('untrusted video cannot initialize webview or external opener',
      (tester) async {
    final v = ExternalVideo(id: '2', title: 'Blocked', channelName: 'Unknown',
      provider: 'youtube', sourceUrl: Uri.parse('https://attacker.example/video'));
    Uri? opened;
    await tester.pumpWidget(MaterialApp(home: OfficialVideoPlayerScreen(
      video: v, embedBuilder: (_) => const Text('SHOULD NEVER BUILD'),
      open: (u) async { opened = u; return true; },
    )));
    expect(find.text('Video unavailable here. Open at source.'), findsOneWidget);
    expect(find.text('SHOULD NEVER BUILD'), findsNothing);
    expect(opened, isNull);
    expect(tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
      isNull);
  });
}
