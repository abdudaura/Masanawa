// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hausa (`ha`).
class AppLocalizationsHa extends AppLocalizations {
  AppLocalizationsHa([String locale = 'ha']) : super(locale);

  @override
  String get appTitle => 'Masanawa';

  @override
  String get home => 'Gida';

  @override
  String get agents => 'Wakilai';

  @override
  String get wallet => 'Walati';

  @override
  String get talk => 'Hira';

  @override
  String get chats => 'Chats';

  @override
  String get status => 'Status';

  @override
  String get calls => 'Calls';

  @override
  String get rooms => 'Rooms';

  @override
  String get explore => 'Bincika';

  @override
  String get liveTalks => 'Hirarraki kai tsaye';

  @override
  String get startTalk => 'Fara hira';

  @override
  String get activity => 'Ayyuka';

  @override
  String get profile => 'Bayanan martaba';

  @override
  String get settings => 'Saituna';

  @override
  String get retry => 'Sake gwadawa';

  @override
  String get cancel => 'Soke';

  @override
  String get confirm => 'Tabbatar';

  @override
  String get loading => 'Ana lodawa…';

  @override
  String get listen => 'Saurara';

  @override
  String get raiseHand => 'Ɗaga hannu';

  @override
  String speakerSeats(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Kujerun masu magana $count',
      one: 'Kujerar mai magana 1',
      zero: 'Babu kujerar mai magana',
    );
    return '$_temp0';
  }

  @override
  String walletAmount(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get splashTagline => 'Hirarraki kai tsaye tsakanin mutane da AI';

  @override
  String get welcomeTitle => 'Barka da zuwa Masanawa';

  @override
  String get checkingSignInMethods => 'Ana duba hanyoyin shiga…';

  @override
  String get signInInstruction =>
      'Shiga ta imel ko waya. Za mu aiko maka da lambar tabbatarwa sau ɗaya.';

  @override
  String get signInMethodsUnavailable =>
      'Ba a samun damar shiga a yanzu. Da fatan a sake gwadawa nan gaba kaɗan.';

  @override
  String get signInMethodsLoadFailed =>
      'Ba a iya ɗauko hanyoyin shiga ba. Duba haɗin intanet ɗinka sannan ka sake gwadawa.';

  @override
  String get invalidPhoneNumber => 'Shigar da ingantacciyar lambar waya';

  @override
  String get invalidEmailAddress => 'Shigar da ingantaccen adireshin imel';

  @override
  String get phoneMethod => 'Waya';

  @override
  String get emailMethod => 'Imel';

  @override
  String get emailExample => 'you@example.com';

  @override
  String get sendingCode => 'Ana aika lamba…';

  @override
  String get sendCode => 'Aika lamba';

  @override
  String get continueAction => 'Ci gaba';

  @override
  String get termsNotice =>
      'Ta ci gaba, ka amince da Sharuɗɗanmu da Manufar Sirri.';

  @override
  String get otpTitle => 'Shigar da lambar';

  @override
  String otpSentTo(String identifier) {
    return 'An aika zuwa $identifier';
  }

  @override
  String get invalidOtpCode => 'Shigar da lambar tabbatarwa mai lambobi 6';

  @override
  String get otpSessionExpired => 'Lokacin shiga ya ƙare. Nemi sabuwar lamba.';

  @override
  String get verifyingCode => 'Ana tabbatarwa…';

  @override
  String get verifyCode => 'Tabbatar';

  @override
  String resendCodeIn(int seconds) {
    return 'Sake aika lamba bayan sakan $seconds';
  }

  @override
  String get resendCode => 'Sake aika lamba';

  @override
  String get passwordCreateTitle => 'Create a password';

  @override
  String get passwordConfirmTitle => 'Repeat your password';

  @override
  String get passwordCreateSubtitle =>
      'Six digits. You will need it when you sign in on a new device.';

  @override
  String get passwordEnterTitle => 'Enter your password';

  @override
  String passwordEnterSubtitle(String identifier) {
    return 'Six-digit password for $identifier';
  }

  @override
  String get passwordMismatch => 'Passwords do not match. Try again.';

  @override
  String get passwordSignIn => 'Sign in';

  @override
  String get nameQuestion => 'Wane suna za mu kira ka?';

  @override
  String get completeProfile => 'Cika bayanan martabarka na Masanawa.';

  @override
  String get codeVerifiedName =>
      'An tabbatar da lambarka. Ƙara sunanka don kammala shiga.';

  @override
  String get fullNameLabel => 'Cikakken suna';

  @override
  String get fullNameExample => 'Misali: Amina Bello';

  @override
  String get fullNameRequired => 'Da fatan a shigar da cikakken sunanka';

  @override
  String get finishingSignIn => 'Ana kammala shiga…';

  @override
  String get verifiedSignInNotice =>
      'Lambar waya ko imel ɗin da aka tabbatar da shi zai ci gaba da zama hanyar shigarka.';

  @override
  String countryDialCode(String code) {
    return 'Lambar ƙasar waya: $code';
  }

  @override
  String get unknownCountryDialCode => 'Ba a gane lambar ƙasar wayar ba';

  @override
  String get authCodeInvalid =>
      'Lambar ba daidai ba ce. Duba ta, sannan ka sake gwadawa.';

  @override
  String get authCodeLocked =>
      'An yi ƙoƙari sau da yawa. Nemi sabuwar lamba daga baya.';

  @override
  String get authCodeExpired =>
      'Lokacin amfani da wannan lambar ya ƙare. Nemi wata sabuwa.';

  @override
  String get authRateLimited => 'An yi buƙatu da yawa. Sake gwadawa daga baya.';

  @override
  String get authSendFailed =>
      'Ba a iya aika lambar ba. Duba haɗin intanet ɗinka sannan ka sake gwadawa.';

  @override
  String get authVerifyFailed =>
      'Ba a iya tabbatar da lambar ba. Sake gwadawa.';

  @override
  String get authProfileFailed =>
      'Ba a iya kammala bayanan martabarka ba. Duba bayananka sannan ka sake gwadawa.';

  @override
  String get languageAction => 'Harshen manhaja';

  @override
  String get languageDialogTitle => 'Zaɓi harshen manhaja';

  @override
  String get languageSystem => 'Yi amfani da harshen na\'ura';

  @override
  String get languageSaveFailed =>
      'Ba a iya adana zaɓin harshe ba. Sake gwadawa.';

  @override
  String get languagePreviewNotice =>
      'Har yanzu ba a fassara wasu shafuka gaba ɗaya ba.';

  @override
  String get languageHausaUnavailable =>
      'Ana kammala tallafin harshen Hausa na manhaja.';

  @override
  String get languageSelected => 'An zaɓa';

  @override
  String get platformAgentsTab => 'Wakilan Masanawa';

  @override
  String get searchPlatformAgents => 'Nemo wakilan Masanawa';

  @override
  String get clearAgentSearch => 'Share binciken wakilai';

  @override
  String get agentsLoadFailed => 'Ba a iya ɗauko wakilai ba. Sake gwadawa.';

  @override
  String get noPlatformAgents => 'Ba a samu wakilan Masanawa a yanzu ba.';

  @override
  String get noMatchingAgents => 'Babu wakilin da ya dace da bincikenka.';

  @override
  String get gwaniUnavailableRetry =>
      'Ba a samun Gwani a yanzu. Sake gwadawa nan gaba kaɗan.';

  @override
  String get gwaniUnavailableNow => 'Ba a samun Gwani a yanzu.';

  @override
  String get searchTalks => 'Nemo hirarraki';

  @override
  String get loadMore => 'Ƙara nunawa';

  @override
  String get statusAvailable => 'Akwai';

  @override
  String get statusListening => 'Yana sauraro…';

  @override
  String get statusWorking => 'Yana aiki';

  @override
  String get statusOnCall => 'Yana kan kira';

  @override
  String get statusOffline => 'Ba ya kan layi';

  @override
  String get statusUnverified => 'Ba a tabbatar da halinsa ba';

  @override
  String statusWorkingTasks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Yana aiki · ayyuka $count',
      one: 'Yana aiki · aiki 1',
    );
    return '$_temp0';
  }
}
