import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/masanawa_theme.dart';

class TwinShareSheet extends StatefulWidget {
  const TwinShareSheet({
    super.key,
    required this.displayName,
    required this.publicUrl,
    required this.onShare,
  });

  final String displayName;
  final String publicUrl;
  final Future<void> Function(String url) onShare;

  @override
  State<TwinShareSheet> createState() => _TwinShareSheetState();
}

class _TwinShareSheetState extends State<TwinShareSheet> {
  bool _copied = false;
  bool _sharing = false;

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: widget.publicUrl));
    if (!mounted) return;
    setState(() => _copied = true);
  }

  Future<void> _share() async {
    if (_sharing) return;
    setState(() => _sharing = true);
    try {
      await widget.onShare(widget.publicUrl);
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: u.structuralBorder,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Share ${widget.displayName}’s twin',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'People can open this link and talk to the AI twin.',
              style: TextStyle(
                color: u.textMuted,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: u.surfaceMuted,
                borderRadius: BorderRadius.circular(14),
              ),
              child: SelectableText(
                widget.publicUrl,
                style: TextStyle(
                  color: u.textPrimary,
                  fontSize: 13,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _copy,
                    icon: Icon(_copied ? Icons.check : Icons.copy_outlined),
                    label: Text(_copied ? 'Copied' : 'Copy link'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _sharing ? null : _share,
                    icon: const Icon(Icons.share_outlined),
                    label: Text(_sharing ? 'Sharing…' : 'Share'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
