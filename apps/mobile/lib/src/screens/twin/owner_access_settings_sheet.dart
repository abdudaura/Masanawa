import 'package:flutter/material.dart';

import '../../../owner_access/owner_access.dart';
import '../../../theme/masanawa_theme.dart';

class OwnerAccessSettingsSheet extends StatefulWidget {
  const OwnerAccessSettingsSheet({
    super.key,
    required this.initial,
    required this.onSave,
  });

  final OwnerAccessOffering initial;
  final Future<void> Function(OwnerAccessOffering offering) onSave;

  @override
  State<OwnerAccessSettingsSheet> createState() =>
      _OwnerAccessSettingsSheetState();
}

class _OwnerAccessSettingsSheetState
    extends State<OwnerAccessSettingsSheet> {
  late bool _enabled;
  late Set<OwnerAccessModality> _modalities;
  late Set<int> _durations;
  late TextEditingController _price;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _enabled = widget.initial.enabled;
    _modalities = {...widget.initial.modalities};
    _durations = {...widget.initial.durationOptionsMinutes};
    _price = TextEditingController(
      text: widget.initial.priceCreditsPerMinute.toString(),
    );
  }

  @override
  void dispose() {
    _price.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final price = int.tryParse(_price.text.trim());
    if (price == null || price < 0) return;
    if (_enabled && (_modalities.isEmpty || _durations.isEmpty)) return;

    setState(() => _saving = true);
    try {
      await widget.onSave(
        OwnerAccessOffering(
          enabled: _enabled,
          modalities: _modalities,
          durationOptionsMinutes: _durations.toList()..sort(),
          priceCreditsPerMinute: price,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    const durationOptions = [15, 30, 60];

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
            const SizedBox(height: 18),
            Text(
              'Talk to me',
              style: TextStyle(
                color: u.textPrimary,
                fontSize: 20,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Let people request a short paid conversation with you.',
              style: TextStyle(color: u.textMuted, height: 1.4),
            ),
            const SizedBox(height: 12),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: _enabled,
              onChanged: (value) => setState(() => _enabled = value),
              title: const Text('Accept requests'),
            ),
            if (_enabled) ...[
              const SizedBox(height: 8),
              Text(
                'Ways to talk',
                style: TextStyle(
                  color: u.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: OwnerAccessModality.values
                    .map(
                      (mode) => FilterChip(
                        label: Text(mode.name),
                        selected: _modalities.contains(mode),
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _modalities.add(mode);
                            } else {
                              _modalities.remove(mode);
                            }
                          });
                        },
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 16),
              Text(
                'Session lengths',
                style: TextStyle(
                  color: u.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: durationOptions
                    .map(
                      (minutes) => FilterChip(
                        label: Text('$minutes min'),
                        selected: _durations.contains(minutes),
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _durations.add(minutes);
                            } else {
                              _durations.remove(minutes);
                            }
                          });
                        },
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _price,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Credits per minute',
                  helperText:
                      'Masanawa will enforce the platform minimum and maximum.',
                ),
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Saving…' : 'Save'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
