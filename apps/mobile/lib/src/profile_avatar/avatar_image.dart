import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// A square crop in oriented, decoded image coordinates. This model never
/// inspects EXIF or depends on which camera/gallery supplied the bytes.
@immutable
class AvatarCrop {
  const AvatarCrop({
    this.centerX = .5,
    this.centerY = .5,
    this.zoom = 1,
  });

  final double centerX;
  final double centerY;
  final double zoom;

  Rect sourceRect({required double width, required double height}) {
    if (width <= 0 || height <= 0 || !width.isFinite || !height.isFinite ||
        !zoom.isFinite || zoom < 1 || zoom > 4) {
      throw ArgumentError('Invalid avatar crop dimensions or zoom');
    }
    final side = (width < height ? width : height) / zoom;
    final left = (centerX.clamp(0.0, 1.0) * width - side / 2)
        .clamp(0.0, width - side).toDouble();
    final top = (centerY.clamp(0.0, 1.0) * height - side / 2)
        .clamp(0.0, height - side).toDouble();
    return Rect.fromLTWH(left, top, side, side);
  }

  AvatarCrop moved({required double dx, required double dy,
      required double width, required double height}) => AvatarCrop(
    centerX: (centerX - dx / width).clamp(0, 1).toDouble(),
    centerY: (centerY - dy / height).clamp(0, 1).toDouble(),
    zoom: zoom,
  );

  AvatarCrop withZoom(double value) => AvatarCrop(
    centerX: centerX, centerY: centerY, zoom: value.clamp(1, 4).toDouble(),
  );
}

/// Decode and redraw pixels to a fresh PNG. Redrawing strips GPS/EXIF/text
/// metadata, applies orientation as decoded by the platform, and limits size.
Future<ui.Image> decodeAvatarSource(Uint8List bytes) async {
  if (bytes.isEmpty || bytes.lengthInBytes > 12 * 1024 * 1024) {
    throw const FormatException('Choose an image smaller than 12 MB');
  }
  final codec = await ui.instantiateImageCodec(
    bytes,
    // Picker already constrains both edges; decoder downsamples wide images.
    // Do not specify both dimensions here, which would distort portraits.
    targetWidth: 2048,
    allowUpscaling: false,
  );
  try {
    final frame = await codec.getNextFrame();
    final image = frame.image;
    if (image.width < 64 || image.height < 64 ||
        image.width > 8192 || image.height > 8192 ||
        image.width * image.height > 24 * 1024 * 1024) {
      image.dispose();
      throw const FormatException('Image dimensions are not supported');
    }
    return image;
  } finally {
    codec.dispose();
  }
}

Future<Uint8List> encodeCroppedAvatar(
    ui.Image source, AvatarCrop crop, {int size = 512}) async {
  if (size < 128 || size > 1024) {
    throw ArgumentError('Avatar output size must be 128–1024 pixels');
  }
  final sourceRect = crop.sourceRect(
    width: source.width.toDouble(), height: source.height.toDouble(),
  );
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  canvas.drawImageRect(
    source, sourceRect,
    Rect.fromLTWH(0, 0, size.toDouble(), size.toDouble()),
    Paint()..filterQuality = FilterQuality.high,
  );
  final picture = recorder.endRecording();
  try {
    final output = await picture.toImage(size, size);
    try {
      final data = await output.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) throw const FormatException('Could not encode avatar');
      final result = data.buffer.asUint8List();
      if (result.lengthInBytes > 2 * 1024 * 1024) {
        throw const FormatException('Cropped image is too large');
      }
      return result;
    } finally {
      output.dispose();
    }
  } finally {
    picture.dispose();
  }
}
