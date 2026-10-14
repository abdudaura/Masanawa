/// Phone-number country mapping. The login screen auto-detects the user's
/// country from an explicit international prefix or manual country selection.
///
/// Rule: a leading `+` (or `00`) means "international" and is matched against
/// known dial codes (longest match wins). A leading `0` or a bare national
/// number falls back to Nigeria (+234, the V1 default).
class PhoneCountry {
  const PhoneCountry({
    required this.dialCode,
    required this.iso,
    required this.name,
    required this.flag,
  });

  /// Digits only, no `+` (e.g. `234`).
  final String dialCode;
  final String iso;
  final String name;
  final String flag;

  String get displayCode => dialCode.isEmpty ? '' : '+$dialCode';
}

const PhoneCountry kDefaultCountry = PhoneCountry(
  dialCode: '234',
  iso: 'NG',
  name: 'Nigeria',
  flag: '🇳🇬',
);

const PhoneCountry kUnknownCountry = PhoneCountry(
  dialCode: '',
  iso: 'UN',
  name: 'Unknown region',
  flag: '🌍',
);

const List<PhoneCountry> kPhoneCountries = [
  PhoneCountry(dialCode: '234', iso: 'NG', name: 'Nigeria', flag: '🇳🇬'),
  PhoneCountry(dialCode: '233', iso: 'GH', name: 'Ghana', flag: '🇬🇭'),
  PhoneCountry(dialCode: '254', iso: 'KE', name: 'Kenya', flag: '🇰🇪'),
  PhoneCountry(dialCode: '27', iso: 'ZA', name: 'South Africa', flag: '🇿🇦'),
  PhoneCountry(dialCode: '256', iso: 'UG', name: 'Uganda', flag: '🇺🇬'),
  PhoneCountry(dialCode: '255', iso: 'TZ', name: 'Tanzania', flag: '🇹🇿'),
  PhoneCountry(dialCode: '250', iso: 'RW', name: 'Rwanda', flag: '🇷🇼'),
  PhoneCountry(dialCode: '237', iso: 'CM', name: 'Cameroon', flag: '🇨🇲'),
  PhoneCountry(dialCode: '221', iso: 'SN', name: 'Senegal', flag: '🇸🇳'),
  PhoneCountry(dialCode: '225', iso: 'CI', name: 'Ivory Coast', flag: '🇨🇮'),
  PhoneCountry(dialCode: '229', iso: 'BJ', name: 'Benin', flag: '🇧🇯'),
  PhoneCountry(dialCode: '226', iso: 'BF', name: 'Burkina Faso', flag: '🇧🇫'),
  PhoneCountry(dialCode: '223', iso: 'ML', name: 'Mali', flag: '🇲🇱'),
  PhoneCountry(dialCode: '227', iso: 'NE', name: 'Niger', flag: '🇳🇪'),
  PhoneCountry(dialCode: '224', iso: 'GN', name: 'Guinea', flag: '🇬🇳'),
  PhoneCountry(dialCode: '232', iso: 'SL', name: 'Sierra Leone', flag: '🇸🇱'),
  PhoneCountry(dialCode: '231', iso: 'LR', name: 'Liberia', flag: '🇱🇷'),
  PhoneCountry(dialCode: '220', iso: 'GM', name: 'Gambia', flag: '🇬🇲'),
  PhoneCountry(dialCode: '235', iso: 'TD', name: 'Chad', flag: '🇹🇩'),
  PhoneCountry(dialCode: '228', iso: 'TG', name: 'Togo', flag: '🇹🇬'),
  PhoneCountry(dialCode: '242', iso: 'CG', name: 'Congo', flag: '🇨🇬'),
  PhoneCountry(dialCode: '243', iso: 'CD', name: 'DR Congo', flag: '🇨🇩'),
  PhoneCountry(dialCode: '251', iso: 'ET', name: 'Ethiopia', flag: '🇪🇹'),
  PhoneCountry(dialCode: '20', iso: 'EG', name: 'Egypt', flag: '🇪🇬'),
  PhoneCountry(dialCode: '212', iso: 'MA', name: 'Morocco', flag: '🇲🇦'),
  PhoneCountry(dialCode: '213', iso: 'DZ', name: 'Algeria', flag: '🇩🇿'),
  PhoneCountry(dialCode: '216', iso: 'TN', name: 'Tunisia', flag: '🇹🇳'),
  PhoneCountry(dialCode: '1', iso: 'US', name: 'USA / Canada', flag: '🇺🇸'),
  PhoneCountry(dialCode: '44', iso: 'GB', name: 'United Kingdom', flag: '🇬🇧'),
  PhoneCountry(dialCode: '353', iso: 'IE', name: 'Ireland', flag: '🇮🇪'),
  PhoneCountry(dialCode: '33', iso: 'FR', name: 'France', flag: '🇫🇷'),
  PhoneCountry(dialCode: '49', iso: 'DE', name: 'Germany', flag: '🇩🇪'),
  PhoneCountry(dialCode: '34', iso: 'ES', name: 'Spain', flag: '🇪🇸'),
  PhoneCountry(dialCode: '39', iso: 'IT', name: 'Italy', flag: '🇮🇹'),
  PhoneCountry(dialCode: '31', iso: 'NL', name: 'Netherlands', flag: '🇳🇱'),
  PhoneCountry(dialCode: '91', iso: 'IN', name: 'India', flag: '🇮🇳'),
  PhoneCountry(dialCode: '92', iso: 'PK', name: 'Pakistan', flag: '🇵🇰'),
  PhoneCountry(dialCode: '880', iso: 'BD', name: 'Bangladesh', flag: '🇧🇩'),
  PhoneCountry(dialCode: '86', iso: 'CN', name: 'China', flag: '🇨🇳'),
  PhoneCountry(dialCode: '971', iso: 'AE', name: 'UAE', flag: '🇦🇪'),
  PhoneCountry(dialCode: '966', iso: 'SA', name: 'Saudi Arabia', flag: '🇸🇦'),
  PhoneCountry(dialCode: '974', iso: 'QA', name: 'Qatar', flag: '🇶🇦'),
  PhoneCountry(dialCode: '61', iso: 'AU', name: 'Australia', flag: '🇦🇺'),
  PhoneCountry(dialCode: '55', iso: 'BR', name: 'Brazil', flag: '🇧🇷'),
];

/// Detects the country from whatever the user typed. Empty input returns the
/// Nigerian default so the field never looks broken.
PhoneCountry detectCountry(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return kDefaultCountry;
  var digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (trimmed.startsWith('00')) {
    digits = digits.replaceFirst(RegExp(r'^00'), '');
  }
  final international = trimmed.startsWith('+') || trimmed.startsWith('00');
  if (!international) return kDefaultCountry;
  for (final c in _byLengthDesc) {
    if (digits.startsWith(c.dialCode)) return c;
  }
  return kUnknownCountry;
}

final List<PhoneCountry> _byLengthDesc = [...kPhoneCountries]
  ..sort((a, b) => b.dialCode.length.compareTo(a.dialCode.length));

/// Normalizes free-typed input to `+`-prefixed E.164.
String normalizeE164(String raw, {PhoneCountry country = kDefaultCountry}) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return '';
  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return '';
  if (trimmed.startsWith('+')) return '+$digits';
  if (trimmed.startsWith('00')) {
    final rest = digits.replaceFirst(RegExp(r'^00'), '');
    return rest.isEmpty ? '' : '+$rest';
  }
  // National digits belong to the selected country. Never infer a dial code
  // from a partially typed local number. Italy keeps its significant zero.
  final national = country.iso == 'IT'
      ? digits
      : digits.replaceFirst(RegExp(r'^0+'), '');
  if (national.isEmpty || country.dialCode.isEmpty) return '';
  return '+${country.dialCode}$national';
}
