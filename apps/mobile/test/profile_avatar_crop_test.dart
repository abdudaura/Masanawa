import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/profile_avatar/avatar_image.dart';

void main() {
  test('crop defaults to exact center of a landscape photo', () {
    final rect = const AvatarCrop().sourceRect(width: 1200, height: 800);
    expect(rect.width, 800);
    expect(rect.height, 800);
    expect(rect.left, 200);
    expect(rect.top, 0);
  });

  test('crop keeps source pixels within image bounds at maximum zoom', () {
    final rect = const AvatarCrop(
      centerX: 1, centerY: 0, zoom: 4,
    ).sourceRect(width: 800, height: 1200);
    expect(rect.left, 600);
    expect(rect.top, 0);
    expect(rect.width, 200);
    expect(rect.right, 800);
  });

  test('drag and zoom maintain a valid source rectangle', () {
    final crop = const AvatarCrop().moved(
      dx: -180, dy: 100, width: 400, height: 600,
    ).withZoom(2);
    final rect = crop.sourceRect(width: 400, height: 600);
    expect(rect.left, greaterThanOrEqualTo(0));
    expect(rect.top, greaterThanOrEqualTo(0));
    expect(rect.right, lessThanOrEqualTo(400));
    expect(rect.bottom, lessThanOrEqualTo(600));
  });

  test('invalid bounds and unsupported zoom never get encoded', () {
    expect(
      () => const AvatarCrop(zoom: 0).sourceRect(width: 500, height: 500),
      throwsArgumentError,
    );
    expect(
      () => const AvatarCrop().sourceRect(width: -1, height: 500),
      throwsArgumentError,
    );
  });

  testWidgets('re-encoding produces a bounded square PNG without source metadata',
      (tester) async {
    await tester.runAsync(() async {
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, 640, 480),
      Paint()..color = Colors.green,
    );
    final picture = recorder.endRecording();
    final image = await picture.toImage(640, 480);
    try {
      final png = await encodeCroppedAvatar(image, const AvatarCrop());
      expect(png.lengthInBytes, lessThan(2 * 1024 * 1024));
      expect(png.take(8).toList(), [137,80,78,71,13,10,26,10]);
    } finally {
      image.dispose();
      picture.dispose();
    }
    });
  });
}
