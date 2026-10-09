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
  String get twinsTab => 'Tagwayen AI';

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
  String privateTwinTalkUnavailable(String name) {
    return 'Ba a samun hira ta sirri da $name a yanzu.';
  }

  @override
  String get viewTwinProfile => 'Duba bayanan martaba';

  @override
  String get searchTalks => 'Nemo hirarraki';

  @override
  String get searchPublicTwins => 'Nemo tagwayen AI na jama\'a';

  @override
  String get clearTwinSearch => 'Share bincike';

  @override
  String get myTwin => 'Tagwayena';

  @override
  String get publicTwin => 'Tagwayen AI na jama\'a';

  @override
  String get noPublicTwins => 'Ba a sami tagwayen AI na jama\'a ba.';

  @override
  String get publicTwinsLoadFailed =>
      'Ba a iya ɗauko tagwayen AI na jama\'a ba. Sake gwadawa.';

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

  @override
  String twinShareText(String name, String url) {
    return 'Yi hira da $name a Masanawa: $url';
  }

  @override
  String get talksTab => 'Tattaunawa';

  @override
  String get chatsTab => 'Saƙonni';

  @override
  String get assistantTab => 'Mataimaki';

  @override
  String get billingRecent => 'Biyan kuɗi na baya-bayan nan';

  @override
  String get billingRefreshHistory => 'Sabunta tarihin biya';

  @override
  String get billingNoPayments => 'Babu biyan kuɗi tukuna';

  @override
  String get billingRecipientLabel => 'Mai karɓa';

  @override
  String get billingServiceAmountLabel => 'Sabis';

  @override
  String get billingFeeLabel => 'Kuɗin hidima';

  @override
  String get billingTotalLabel => 'Jimilla';

  @override
  String get billingStatusLabel => 'Hali';

  @override
  String get billingProviderRef => 'Lambar mai bayarwa';

  @override
  String get billingTokenLabel => 'Lambar token / code';

  @override
  String get billingRefundedInfo =>
      'An mayar da kuɗin da aka tabbatar an biya.';

  @override
  String get billingSuccess => 'An kammala biyan kuɗin.';

  @override
  String get billingStatusQuoted => 'An shirya farashi';

  @override
  String get billingStatusAwaiting => 'Ana jiran biya';

  @override
  String get billingStatusFunded => 'An tabbatar da biya';

  @override
  String get billingStatusProcessing => 'Ana sarrafawa';

  @override
  String get billingStatusCompleted => 'An kammala';

  @override
  String get billingStatusRefundProcessing => 'Ana mayar da kuɗi';

  @override
  String get billingStatusRefunded => 'An mayar da kuɗi';

  @override
  String get billingStatusExpired => 'Ya ƙare';

  @override
  String get billingStatusFailed => 'Ya gaza';

  @override
  String get billingStatusAwaitingFunds => 'Ana jiran kuɗi';

  @override
  String get billingStatusUnknown => 'Ba a samu halin biya ba';

  @override
  String get billingTitle => 'Biyan kuɗi da takardun biya';

  @override
  String get billingNew => 'Sabon biyan kuɗi';

  @override
  String get billingPayTitle => 'Biya kuɗi';

  @override
  String get billingInstructions =>
      'Zaɓi sabis na mai bayarwa da yake aiki. Ana biyan kuɗin daga walat ɗin Masanawa a manhaja.';

  @override
  String get billingCategory => 'Rukuni';

  @override
  String get billingProvider => 'Mai bayarwa';

  @override
  String get billingService => 'Sabis';

  @override
  String get billingPhone => 'Lambar waya';

  @override
  String get billingRecipient => 'Lambar abokin ciniki / mita / kati';

  @override
  String get billingAmount => 'Adadi (NGN)';

  @override
  String get billingVariableHelp =>
      'Shigar da adadin da mai bayarwa ya amince da shi.';

  @override
  String get billingFixedHelp => 'Mai bayarwa ne ya kayyade adadin.';

  @override
  String get billingReview => 'Duba farashin';

  @override
  String billingConfirmWallet(String amount) {
    return 'Tabbatar da $amount daga walat';
  }

  @override
  String billingAddFunds(String amount) {
    return 'Ƙara $amount';
  }

  @override
  String get billingTransferInstructions =>
      'Tura ainihin adadin da ke ƙasa. Masanawa za ta ci gaba da biyan kuɗin bayan an tabbatar da turawar.';

  @override
  String get billingExpires => 'Zai ƙare:';

  @override
  String get billingRefresh => 'Sabunta halin biyan kuɗi';

  @override
  String get billingAnother => 'Sake biyan wani kuɗi';

  @override
  String get billingUnavailable => 'Ba a samun sabis ɗin biya a yanzu.';

  @override
  String get billingProvidersUnavailable => 'Ba a iya ɗauko masu bayarwa ba.';

  @override
  String get billingServicesUnavailable => 'Ba a iya ɗauko sabis ba.';

  @override
  String get billingSelectionRequired => 'Zaɓi rukuni, mai bayarwa da sabis.';

  @override
  String get billingInvalidDetails =>
      'Shigar da bayanan mai karɓa da adadi masu inganci.';

  @override
  String get billingQuoteFailed => 'Ba a iya ƙirƙirar farashi ba.';

  @override
  String get billingPurchaseFailed => 'Ba a iya kammala biyan daga walat ba.';

  @override
  String get billingRefreshFailed => 'Ba a iya sabunta hali ba.';

  @override
  String get billingDetailsFailed => 'Ba a iya ɗauko bayanan biyan ba.';

  @override
  String get billingSignInAgain => 'Lokacin zamanka ya ƙare. Sake shiga.';

  @override
  String get billingExpiredTryAgain =>
      'Lokacin farashin ya ƙare. Nemi sabon farashi.';
}
