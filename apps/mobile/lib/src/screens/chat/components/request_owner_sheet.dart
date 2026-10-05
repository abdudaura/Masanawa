import 'package:flutter/material.dart';

import '../../../owner_access/owner_access.dart';
import '../../../theme/masanawa_theme.dart';

class RequestOwnerSheet extends StatefulWidget {
  const RequestOwnerSheet({
    super.key,
    required this.ownerName,
    required this.onQuote,
  });

  final String ownerName;
  final Future<void> Function(
    OwnerAccessModality modality,
    int durationMinutes,
  ) onQuote;

  @override
  State<RequestOwnerSheet> createState() => _RequestOwnerSheetState();
}

class _RequestOwnerSheetState extends State<RequestOwnerSheet> {
  OwnerAccessModality _modality = OwnerAccessModality.voice;
  int _duration = 15;
  bool _loading = false;

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
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Talk to ${widget.ownerName}',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Send a paid request to speak with the real owner. Funds are held until the qualifying conversation happens; otherwise they are returned under policy.',
              style: TextStyle(color: u.textMuted, height: 1.45),
            ),
            const SizedBox(height: 18),
            SegmentedButton<OwnerAccessModality>(
              segments: const [
                ButtonSegment(
                  value: OwnerAccessModality.text,
                  label: Text('Text'),
                  icon: Icon(Icons.chat_bubble_outline),
                ),
                ButtonSegment(
                  value: OwnerAccessModality.voice,
                  label: Text('Voice'),
                  icon: Icon(Icons.call_outlined),
                ),
                ButtonSegment(
                  value: OwnerAccessModality.video,
                  label: Text('Video'),
                  icon: Icon(Icons.videocam_outlined),
                ),
              ],
              selected: {_modality},
              onSelectionChanged: (selection) {
                setState(() => _modality = selection.first);
              },
            ),
            const SizedBox(height: 18),
            Text(
              'Duration',
              style: TextStyle(
                color: u.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [15, 30, 60]
                  .map(
                    (minutes) => ChoiceChip(
                      label: Text('$minutes min'),
                      selected: _duration == minutes,
                      onSelected: (_) => setState(() => _duration = minutes),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _loading
                    ? null
                    : () async {
                        setState(() => _loading = true);
                        try {
                          await widget.onQuote(_modality, _duration);
                        } finally {
                          if (mounted) setState(() => _loading = false);
                        }
                      },
                child: Text(_loading ? 'Checking…' : 'See price & availability'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
