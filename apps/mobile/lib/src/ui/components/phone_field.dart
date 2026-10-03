import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/phone/country_codes.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../theme/masanawa_theme.dart';

/// WhatsApp-style phone input with automatic country detection: as the user
/// types an international number (`+233 ...`), the flag + dial code + country
/// name update live. Bare national numbers fall back to Nigeria (+234).
class PhoneField extends StatefulWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.autofocus = false,
    this.onCountryChanged,
  });

  final TextEditingController controller;
  final bool autofocus;
  final ValueChanged<PhoneCountry>? onCountryChanged;

  @override
  State<PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<PhoneField> {
  PhoneCountry _country = kDefaultCountry;

  @override
  void initState() {
    super.initState();
    _country = detectCountry(widget.controller.text);
  }

  void _onChanged(String value) {
    final detected = detectCountry(value);
    if (detected.iso != _country.iso ||
        detected.dialCode != _country.dialCode) {
      setState(() => _country = detected);
      widget.onCountryChanged?.call(detected);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: widget.controller,
          autofocus: widget.autofocus,
          keyboardType: TextInputType.phone,
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
          ],
          onChanged: _onChanged,
          style: TextStyle(
            fontSize: UnigeriaTokens.fontSize['md'],
            color: Theme.of(context).colorScheme.onSurface,
          ),
          decoration: InputDecoration(
            prefixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(width: 12),
                Text(_country.flag, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: 6),
                Text(
                  _country.displayCode.isEmpty ? '–––' : _country.displayCode,
                  style: TextStyle(
                    fontSize: UnigeriaTokens.fontSize['md'],
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                const SizedBox(width: 8),
              ],
            ),
            hintText: '+234 801 234 5678',
            hintStyle: TextStyle(color: u.textMuted),
            filled: true,
            fillColor: u.surfaceCard,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(UnigeriaTokens.radius['md']!),
              borderSide: BorderSide(color: u.structuralBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(UnigeriaTokens.radius['md']!),
              borderSide: BorderSide(color: u.structuralBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(UnigeriaTokens.radius['md']!),
              borderSide: BorderSide(color: u.brand, width: 2),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Detected country: ${_country.flag} ${_country.name}',
          style: TextStyle(
            fontSize: UnigeriaTokens.fontSize['xs'],
            color: u.textMuted,
          ),
        ),
      ],
    );
  }
}
