import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'avatar_image.dart';

/// Platform media picker, followed by an actual interactive pixel crop. Nothing
/// is saved until the caller uploads the returned PNG and receives success.
Future<Uint8List?> pickAndCropAvatar(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    useSafeArea: true,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Choose from gallery'),
            onTap: () => Navigator.of(sheetContext).pop(ImageSource.gallery),
          ),
          ListTile(
            leading: const Icon(Icons.camera_alt_outlined),
            title: const Text('Take a photo'),
            onTap: () => Navigator.of(sheetContext).pop(ImageSource.camera),
          ),
        ],
      ),
    ),
  );
  if (source == null || !context.mounted) return null;
  final selected = await ImagePicker().pickImage(
    source: source, maxWidth: 2048, maxHeight: 2048, imageQuality: 94,
  );
  if (selected == null || !context.mounted) return null;
  final bytes = await selected.readAsBytes();
  if (bytes.lengthInBytes > 12 * 1024 * 1024) {
    throw const FormatException('Choose an image smaller than 12 MB');
  }
  if (!context.mounted) return null;
  return showAvatarCropSheet(context, sourceBytes: bytes);
}

Future<Uint8List?> showAvatarCropSheet(
  BuildContext context, {required Uint8List sourceBytes},
) => showModalBottomSheet<Uint8List>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  builder: (_) => _AvatarCropSheet(sourceBytes: sourceBytes),
);

class _AvatarCropSheet extends StatefulWidget {
  const _AvatarCropSheet({required this.sourceBytes});
  final Uint8List sourceBytes;

  @override
  State<_AvatarCropSheet> createState() => _AvatarCropSheetState();
}

class _AvatarCropSheetState extends State<_AvatarCropSheet> {
  ui.Image? _image;
  AvatarCrop _crop = const AvatarCrop();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _decode();
  }

  Future<void> _decode() async {
    try {
      final image = await decodeAvatarSource(widget.sourceBytes);
      if (!mounted) {
        image.dispose();
        return;
      }
      setState(() => _image = image);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not open this image.');
    }
  }

  @override
  void dispose() {
    _image?.dispose();
    super.dispose();
  }

  Future<void> _finish() async {
    final image = _image;
    if (image == null || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final png = await encodeCroppedAvatar(image, _crop);
      if (!mounted) return;
      Navigator.of(context).pop(png);
    } catch (_) {
      if (mounted) {
        setState(() => _error =
            'This photo could not be prepared. Adjust the crop or choose another.');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final image = _image;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20, 18, 20, MediaQuery.viewInsetsOf(context).bottom + 28,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Crop profile photo',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
          const SizedBox(height: 8),
          const Text('Drag to position your face. Zoom to adjust the crop.'),
          const SizedBox(height: 20),
          if (image == null)
            SizedBox(
              height: 260,
              child: Center(child: _error == null
                  ? const CircularProgressIndicator()
                  : Text(_error!, textAlign: TextAlign.center)),
            )
          else
            GestureDetector(
              key: const ValueKey('avatar-drag-crop'),
              onPanUpdate: _saving ? null : (details) {
                setState(() => _crop = _crop.moved(
                  dx: details.delta.dx * image.width / 260,
                  dy: details.delta.dy * image.height / 260,
                  width: image.width.toDouble(),
                  height: image.height.toDouble(),
                ));
              },
              child: SizedBox(
                height: 260,
                width: 260,
                child: CustomPaint(
                  painter: _AvatarCropPainter(image: image, crop: _crop),
                ),
              ),
            ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Icon(Icons.zoom_out_rounded),
              Expanded(
                child: Slider(
                  value: _crop.zoom,
                  min: 1,
                  max: 4,
                  divisions: 30,
                  label: 'Zoom',
                  onChanged: image == null || _saving ? null : (value) {
                    setState(() => _crop = _crop.withZoom(value));
                  },
                ),
              ),
              const Icon(Icons.zoom_in_rounded),
            ],
          ),
          if (_error != null && image != null)
            Text(_error!, style: TextStyle(
              color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              key: const ValueKey('avatar-confirm-crop'),
              onPressed: image == null || _saving ? null : _finish,
              child: _saving
                  ? const CircularProgressIndicator(strokeWidth: 2)
                  : const Text('Use photo'),
            ),
          ),
        ],
      ),
    );
  }
}

class _AvatarCropPainter extends CustomPainter {
  const _AvatarCropPainter({required this.image, required this.crop});
  final ui.Image image;
  final AvatarCrop crop;

  @override
  void paint(Canvas canvas, Size size) {
    final destination = Rect.fromLTWH(0, 0, size.width, size.height);
    canvas.save();
    canvas.clipRRect(RRect.fromRectAndRadius(destination,
        Radius.circular(size.shortestSide / 2)));
    canvas.drawImageRect(
      image,
      crop.sourceRect(
        width: image.width.toDouble(), height: image.height.toDouble(),
      ),
      destination,
      Paint()..filterQuality = FilterQuality.high,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_AvatarCropPainter old) =>
      old.image != image || old.crop != crop;
}
