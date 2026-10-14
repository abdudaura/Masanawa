import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../l10n/app_localizations.dart';
import '../../core/phone/country_codes.dart';
import '../../localization/international_digits.dart';
import '../../tokens/masanawa_tokens.dart';
import '../../theme/masanawa_theme.dart';

/// WhatsApp-style phone input with automatic country detection: as the user
/// types an international number (`+233 ...`), the flag + dial code + country
/// name update live. National numbers use the country selected by the user.
class PhoneField extends StatefulWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.autofocus = false,
    this.onCountryChanged,
    this.enabled = true,
    this.initialCountry = kDefaultCountry,
  });

  final TextEditingController controller;
  final bool autofocus;
  final ValueChanged<PhoneCountry>? onCountryChanged;
  final bool enabled;
  final PhoneCountry initialCountry;

  @override
  State<PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<PhoneField> {
  PhoneCountry _country = kDefaultCountry;

  @override
  void initState() {
    super.initState();
    final raw = widget.controller.text.trim();
    _country = raw.startsWith('+') || raw.startsWith('00')
        ? detectCountry(raw)
        : widget.initialCountry;
    widget.controller.addListener(_onControllerChanged);
  }

  @override
  void didUpdateWidget(PhoneField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onControllerChanged);
      widget.controller.addListener(_onControllerChanged);
      _onControllerChanged();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    super.dispose();
  }

  void _onControllerChanged() => _onChanged(widget.controller.text);

  void _onChanged(String value) {
    final trimmed = value.trim();
    if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return;
    final detected = detectCountry(value);
    if (detected.iso != _country.iso ||
        detected.dialCode != _country.dialCode) {
      setState(() => _country = detected);
      widget.onCountryChanged?.call(detected);
    }
  }

  void _selectCountry(PhoneCountry country) {
    final raw = widget.controller.text.trim();
    final previous = _country;
    setState(() => _country = country);
    widget.onCountryChanged?.call(country);
    if ((raw.startsWith('+') || raw.startsWith('00')) &&
        previous.dialCode.isNotEmpty) {
      final international = normalizeE164(raw);
      final prefix = '+${previous.dialCode}';
      final national = international.startsWith(prefix)
          ? international.substring(prefix.length)
          : '';
      final replacement = '+${country.dialCode}$national';
      widget.controller.value = TextEditingValue(
        text: replacement,
        selection: TextSelection.collapsed(offset: replacement.length),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = context.masanawa;
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: widget.controller,
          enabled: widget.enabled,
          autofocus: widget.autofocus,
          keyboardType: TextInputType.phone,
          inputFormatters: [
            const InternationalDigitsFormatter(),
            FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
          ],
          onChanged: _onChanged,
          style: TextStyle(
            fontSize: MasanawaTokens.fontSize['md'],
            color: Theme.of(context).colorScheme.onSurface,
          ),
          decoration: InputDecoration(
            prefixIcon: PopupMenuButton<PhoneCountry>(
              key: const Key('phone-country-picker'),
              enabled: widget.enabled,
              tooltip: l10n.countryDialCode(_country.displayCode),
              onSelected: _selectCountry,
              itemBuilder: (_) => [
                for (final country in kPhoneCountries)
                  PopupMenuItem(
                    key: Key('phone-country-${country.iso}'),
                    value: country,
                    child: Text(
                      '${country.flag} ${country.name} ${country.displayCode}',
                    ),
                  ),
              ],
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(width: 12),
                  Text(_country.flag, style: const TextStyle(fontSize: 22)),
                  const SizedBox(width: 6),
                  Text(
                    _country.displayCode.isEmpty ? '–––' : _country.displayCode,
                    style: TextStyle(
                      fontSize: MasanawaTokens.fontSize['md'],
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_drop_down, size: 20),
                ],
              ),
            ),
            hintText: '${_country.displayCode} …',
            hintStyle: TextStyle(color: u.textMuted),
            filled: true,
            fillColor: u.surfaceCard,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(MasanawaTokens.radius['md']!),
              borderSide: BorderSide(color: u.structuralBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(MasanawaTokens.radius['md']!),
              borderSide: BorderSide(color: u.structuralBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(MasanawaTokens.radius['md']!),
              borderSide: BorderSide(color: u.brand, width: 2),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _country.displayCode.isEmpty
              ? l10n.unknownCountryDialCode
              : '${_country.flag} ${l10n.countryDialCode(_country.displayCode)}',
          style: TextStyle(
            fontSize: MasanawaTokens.fontSize['xs'],
            color: u.textMuted,
          ),
        ),
      ],
    );
  }
}
