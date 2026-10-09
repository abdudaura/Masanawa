import 'package:flutter/widgets.dart';

/// Isolated U19 first-use copy. This is NOT an application-wide Hausa locale
/// delegate. R11 still owns the complete translated locale catalogue.
final class QuickStartCopy {
  const QuickStartCopy._(this.hausa);
  final bool hausa;

  factory QuickStartCopy.forLocale(Locale locale) =>
      QuickStartCopy._(locale.languageCode.toLowerCase() == 'ha');

  String get title => hausa ? 'Fara amfani da Masanawa' : 'Find your way in Masanawa';
  String get explanation => hausa
      ? 'Zaɓi abin da kake son yi. Babu buƙatar makirufo ko lambar mai haɓakawa.'
      : 'Choose what you want to do. No microphone or developer token is needed.';
  String get draftLabel => hausa
      ? 'Rubuta abin da kake son yi (zaɓi ne)'
      : 'Write a note for yourself (optional)';
  String get draftHint => hausa
      ? 'Ba za a aika wannan rubutu kai tsaye ba'
      : 'This note will not be sent automatically';
  String get reviewTitle => hausa ? 'Duba kafin buɗewa' : 'Review before opening';
  String get reviewExplanation => hausa
      ? 'Buɗewa ba ta fara kira, magana, saye ko aika saƙo.'
      : 'Opening will not start audio, send a message, or make a payment.';
  String get noteNotice => hausa
      ? 'Rubutun nan zai kasance daftari kawai, ba saƙon da aka aika ba.'
      : 'Your note remains a draft, not a sent message.';
  String get choose => hausa ? 'Ci gaba' : 'Continue';
  String get open => hausa ? 'Buɗe' : 'Open';
  String get back => hausa ? 'Koma baya' : 'Back';
  String get skip => hausa ? 'Tsallake' : 'Skip';
  String get sectionLabel => hausa ? 'Zaɓi wani sashe' : 'Choose a section';

  String targetTitle(QuickStartTarget target) => switch (target) {
    QuickStartTarget.talks => hausa ? 'Tattaunawa kai tsaye' : 'Talks',
    QuickStartTarget.chats => hausa ? 'Saƙonnin mutane' : 'Chats',
    QuickStartTarget.assistant => hausa ? 'Mataimaki' : 'Assistant',
    QuickStartTarget.wallet => hausa ? 'Walit' : 'Wallet',
    QuickStartTarget.agents => hausa ? 'Masana da Twins' : 'Agents',
  };

  String targetDetail(QuickStartTarget target) => switch (target) {
    QuickStartTarget.talks => hausa
        ? 'Duba tattaunawar jama’a; sauraro ba ya kunna makirufo.'
        : 'Explore public live talks without turning on your microphone.',
    QuickStartTarget.chats => hausa
        ? 'Nemo mutumin da ya amince da tattaunawa.'
        : 'Find an accepted human contact to message.',
    QuickStartTarget.assistant => hausa
        ? 'Tambayi Gwani ko Gwana a sirrance.'
        : 'Ask Gwani or Gwana privately by text or voice.',
    QuickStartTarget.wallet => hausa
        ? 'Duba sabis da kuɗi, ba tare da saye ba.'
        : 'Review qualified services and balances, without purchasing.',
    QuickStartTarget.agents => hausa
        ? 'Nemo Masana da Twins; ba za a ɗauki kuɗi ba.'
        : 'Browse Experts and Twins without admitting a paid Seat.',
  };
}

/// Exact five product destinations only. The owning shell composes navigation.
enum QuickStartTarget { talks, chats, assistant, wallet, agents }
