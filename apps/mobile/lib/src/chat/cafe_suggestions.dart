/// Internet Cafe quick options.
 ///
 /// Each suggestion is plain chat text the billing assistant already
 /// understands — tapping one just types for the user, so buying stays
 /// conversational and every option remains reselectable by tapping again
 /// or by typing freely.
class CafeSuggestion {
  const CafeSuggestion({
    required this.key,
    required this.label,
    required this.message,
  });

  /// Stable key (also used to highlight the last-tapped chip).
  final String key;

  /// Short chip label shown above the composer.
  final String label;

  /// Full chat text sent when the chip is tapped.
  final String message;
}

/// Conversational Masanawa service shortcuts, in display order.
const kCafeSuggestions = <CafeSuggestion>[
  CafeSuggestion(key: 'data', label: 'Data', message: 'Buy data'),
  CafeSuggestion(key: 'airtime', label: 'Airtime', message: 'Buy airtime'),
  CafeSuggestion(
    key: 'electricity',
    label: 'Electricity',
    message: 'Pay electricity bill',
  ),
  CafeSuggestion(
    key: 'tv',
    label: 'TV',
    message: 'Pay TV subscription',
  ),
  CafeSuggestion(
    key: 'crypto',
    label: 'Crypto',
    message: 'Help me with crypto',
  ),
];
