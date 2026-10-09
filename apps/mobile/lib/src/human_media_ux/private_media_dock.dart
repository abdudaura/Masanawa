import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import 'private_media_draft.dart';

/// Uses the existing native picker. No contact access or automatic uploads.
class PlatformPrivateMediaPicker implements PrivateMediaPicker {
  @override
  Future<File?> pick() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'pdf'],
      withData: false,
      allowMultiple: false,
    );
    final path = result?.files.singleOrNull?.path;
    return path == null ? null : File(path);
  }
}

/// Mount beneath the real C02 human-only thread, with the *existing* C04
/// HumanVoiceNotesPanel supplied as voiceNotes by its integration owner.
class HumanPrivateMediaDock extends StatefulWidget {
  const HumanPrivateMediaDock({
    super.key,
    required this.controller,
    required this.voiceNotes,
    this.dataSaver = false,
  });

  final PrivateMediaReviewController controller;
  final Widget voiceNotes;
  final bool dataSaver;

  @override
  State<HumanPrivateMediaDock> createState() => _HumanPrivateMediaDockState();
}

class _HumanPrivateMediaDockState extends State<HumanPrivateMediaDock> {
  File? _cachedPreview;
  bool _showImage = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    final initial = widget.controller.draft;
    _cachedPreview = initial?.kind.isImage == true ? initial!.file : null;
    _showImage = _cachedPreview != null && !widget.dataSaver;
  }

  void _changed() {
    final draft = widget.controller.draft;
    final next = draft?.kind.isImage == true ? draft!.file : null;
    if (_cachedPreview?.path != next?.path) {
      _forgetImage(_cachedPreview);
      _cachedPreview = next;
      _showImage = !widget.dataSaver;
    }
    if (mounted) setState(() {});
  }

  void _forgetImage(File? file) {
    if (file != null) unawaited(FileImage(file).evict().then((_) {}));
  }

  @override
  void didUpdateWidget(covariant HumanPrivateMediaDock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_changed);
      _forgetImage(_cachedPreview);
      _cachedPreview = null;
      _showImage = false;
      widget.controller.addListener(_changed);
      final initial = widget.controller.draft;
      _cachedPreview = initial?.kind.isImage == true ? initial!.file : null;
      _showImage = _cachedPreview != null && !widget.dataSaver;
    }
    if (oldWidget.dataSaver != widget.dataSaver && widget.dataSaver) {
      _showImage = false;
      _forgetImage(_cachedPreview);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _forgetImage(_cachedPreview);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.controller;
    final media = state.draft;
    final busy = state.phase == PrivateMediaPhase.inspecting ||
        state.phase == PrivateMediaPhase.uploading;
    final scheme = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        widget.voiceNotes,
        if (state.message != null)
          Semantics(
            liveRegion: true,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Text(state.message!,
                  style: TextStyle(color: scheme.error)),
            ),
          ),
        if (media != null)
          Card(
            margin: const EdgeInsets.all(8),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Icon(media.kind.isImage
                        ? Icons.image_outlined
                        : Icons.picture_as_pdf_outlined),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(media.name, maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                    ),
                    IconButton(
                      tooltip: 'Discard attachment',
                      onPressed: busy ? null : state.clear,
                      icon: const Icon(Icons.close),
                    ),
                  ]),
                  Text((media.sizeBytes / 1024).ceil().toString() +
                    ' KB · ' + media.kind.mime),
                  if (media.kind.isImage && !_showImage)
                    TextButton.icon(
                      onPressed: () => setState(() => _showImage = true),
                      icon: const Icon(Icons.visibility_outlined),
                      label: const Text('Preview image on this device'),
                    ),
                  if (media.kind.isImage && _showImage)
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 180),
                      child: Image.file(
                        media.file,
                        fit: BoxFit.contain,
                        cacheWidth: 480,
                        filterQuality: FilterQuality.low,
                        errorBuilder: (_, __, ___) => const Text(
                          'Image cannot be previewed. No file was uploaded.'),
                      ),
                    ),
                  if (media.kind == PrivateMediaKind.pdf)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text('PDF selected. File metadata only.'),
                    ),
                  if (state.phase == PrivateMediaPhase.uploading)
                    LinearProgressIndicator(
                      value: state.progress,
                      semanticsLabel: 'Private attachment upload progress',
                    ),
                  if (state.phase == PrivateMediaPhase.sent)
                    const Text('Private message receipt confirmed.'),
                  if (state.uploadPort == null)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: Text(
                        'Preview only. Secure image and document sending is unavailable.'),
                    ),
                  if (state.canSend || state.canRetry)
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton.icon(
                        onPressed: state.send,
                        icon: Icon(state.canRetry ? Icons.refresh : Icons.send),
                        label: Text(state.canRetry
                            ? 'Retry same private request'
                            : 'Send private attachment'),
                      ),
                    ),
                ],
              ),
            ),
          ),
        if (state.phase != PrivateMediaPhase.sent)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: busy ? null : state.choose,
              icon: const Icon(Icons.attach_file),
              label: Text(media == null
                  ? 'Review image or PDF'
                  : 'Choose a different attachment'),
            ),
          ),
        if (state.phase == PrivateMediaPhase.inspecting)
          const LinearProgressIndicator(
            minHeight: 2,
            semanticsLabel: 'Checking attachment on device',
          ),
      ],
    );
  }
}
