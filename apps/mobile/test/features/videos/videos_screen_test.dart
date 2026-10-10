import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/features/videos/video_models.dart';
import 'package:mobile/src/features/videos/videos_screen.dart';

void main() {
  testWidgets('shows loading without imaginary videos', (tester) async {
    await tester.pumpWidget(MaterialApp(home: VideosScreen(
      state: VideosLoadState.loading, videos: const [], onOpenProvider: (_) {})));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
  testWidgets('shows honest empty state', (tester) async {
    await tester.pumpWidget(MaterialApp(home: VideosScreen(
      state: VideosLoadState.empty, videos: const [], onOpenProvider: (_) {})));
    expect(find.text('No curated videos yet'), findsOneWidget);
  });
}
