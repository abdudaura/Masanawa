class CafeSuggestion {
  const CafeSuggestion({
    required this.key,
    required this.label,
    required this.message,
  });

  final String key;
  final String label;

  /// Plain chat text sent to the support agent. This keeps the service flow
  /// conversational instead of inventing a second forms runtime in the app.
  final String message;
}

const List<CafeSuggestion> kCafeSuggestions = [
  CafeSuggestion(
    key: 'data',
    label: 'Data',
    message: 'I want to buy data.',
  ),
  CafeSuggestion(
    key: 'airtime',
    label: 'Airtime',
    message: 'I want to buy airtime.',
  ),
  CafeSuggestion(
    key: 'electricity',
    label: 'Electricity',
    message: 'I want to pay for electricity.',
  ),
  CafeSuggestion(
    key: 'tv',
    label: 'TV',
    message: 'I want to pay for TV.',
  ),
];
