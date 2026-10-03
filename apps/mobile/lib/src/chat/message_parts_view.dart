import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme/masanawa_theme.dart';
import 'chat_format.dart';
import 'message_parts.dart';

class MessagePartsView extends StatelessWidget {
  const MessagePartsView({super.key, required this.parts});

  final List<AgentMessagePart> parts;

  @override
  Widget build(BuildContext context) {
    if (parts.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final part in parts) ...[
          _PartCard(part: part),
          if (part != parts.last) const SizedBox(height: 7),
        ],
      ],
    );
  }
}

class _PartCard extends StatelessWidget {
  const _PartCard({required this.part});

  final AgentMessagePart part;

  IconData get icon => switch (part.kind) {
        AgentMessagePartKind.audio => Icons.graphic_eq,
        AgentMessagePartKind.image => Icons.image_outlined,
        AgentMessagePartKind.file => Icons.insert_drive_file_outlined,
        AgentMessagePartKind.artifact => Icons.auto_awesome_outlined,
        AgentMessagePartKind.work => Icons.work_outline,
        AgentMessagePartKind.approval => Icons.approval_outlined,
        AgentMessagePartKind.operation => Icons.sync_alt,
        AgentMessagePartKind.callResult => Icons.call_outlined,
        AgentMessagePartKind.status => Icons.info_outline,
      };

  String get fallbackTitle => switch (part.kind) {
        AgentMessagePartKind.audio => 'Voice response',
        AgentMessagePartKind.image => 'Image',
        AgentMessagePartKind.file => 'File',
        AgentMessagePartKind.artifact => 'Work result',
        AgentMessagePartKind.work => 'Work update',
        AgentMessagePartKind.approval => 'Approval needed',
        AgentMessagePartKind.operation => 'Action update',
        AgentMessagePartKind.callResult => 'Call result',
        AgentMessagePartKind.status => 'Status',
      };

  Future<void> _openFile() async {
    final value = part.file?.previewUrl ?? part.file?.downloadUrl;
    if (value == null) return;
    final uri = Uri.tryParse(value);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final file = part.file;
    final total = part.progressTotal;
    final current = part.progressCurrent;
    final progress = total != null && total > 0 && current != null
        ? (current / total).clamp(0.0, 1.0)
        : null;

    return Container(
      margin: const EdgeInsets.only(top: 7),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: u.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: u.structuralBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: u.brand),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  part.title ?? file?.name ?? fallbackTitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: u.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (part.status != null)
                Text(
                  part.status!,
                  style: TextStyle(color: u.textMuted, fontSize: 11),
                ),
            ],
          ),
          if (part.body?.isNotEmpty == true) ...[
            const SizedBox(height: 7),
            Text(
              part.body!,
              style: TextStyle(color: u.textMuted, fontSize: 13, height: 1.35),
            ),
          ],
          if (file?.sizeBytes != null) ...[
            const SizedBox(height: 5),
            Text(
              formatBytes(file!.sizeBytes!),
              style: TextStyle(color: u.textMuted, fontSize: 11),
            ),
          ],
          if (progress != null) ...[
            const SizedBox(height: 9),
            LinearProgressIndicator(value: progress),
            const SizedBox(height: 4),
            Text(
              '$current / $total',
              style: TextStyle(color: u.textMuted, fontSize: 11),
            ),
          ],
          if (file != null &&
              (file.previewUrl != null || file.downloadUrl != null)) ...[
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: _openFile,
              icon: const Icon(Icons.open_in_new, size: 17),
              label: const Text('Open'),
            ),
          ],
          if (part.actionLabel?.isNotEmpty == true) ...[
            const SizedBox(height: 5),
            Text(
              part.actionLabel!,
              style: TextStyle(
                color: u.brand,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
