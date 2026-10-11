import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_ha.dart';
import 'app_localizations_pt.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
    Locale('es'),
    Locale('fr'),
    Locale('ha'),
    Locale('pt'),
  ];

  /// Brand name, not translated
  ///
  /// In en, this message translates to:
  /// **'Masanawa'**
  String get appTitle;

  /// Bottom navigation: public Talk discovery
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// Bottom navigation: Masanawa Experts and personal Twins
  ///
  /// In en, this message translates to:
  /// **'Agents'**
  String get agents;

  /// Bottom navigation: balances and financial services
  ///
  /// In en, this message translates to:
  /// **'Wallet'**
  String get wallet;

  /// Bottom navigation: private AI conversation, not a public Talk
  ///
  /// In en, this message translates to:
  /// **'Talk'**
  String get talk;

  /// Bottom navigation: Masana conversations
  ///
  /// In en, this message translates to:
  /// **'Chats'**
  String get chats;

  /// Bottom navigation: Masana status updates
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// Bottom navigation: voice and video calls
  ///
  /// In en, this message translates to:
  /// **'Calls'**
  String get calls;

  /// Bottom navigation: audio group rooms
  ///
  /// In en, this message translates to:
  /// **'Rooms'**
  String get rooms;

  /// Home discovery feed tab
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get explore;

  /// Home currently live public Talk feed tab
  ///
  /// In en, this message translates to:
  /// **'Live Talks'**
  String get liveTalks;

  /// Start composing a human-hosted public Talk, does not broadcast immediately
  ///
  /// In en, this message translates to:
  /// **'Start Talk'**
  String get startTalk;

  /// Notification/activity screen
  ///
  /// In en, this message translates to:
  /// **'Activity'**
  String get activity;

  /// Current user's account profile
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// Application settings
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// Retry a failed load or recoverable request
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get retry;

  /// Discard a pending action without committing
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// Affirm a pending action; money still needs a server-authorized quote
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get confirm;

  /// Data loading status
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get loading;

  /// Join audience of a public Talk
  ///
  /// In en, this message translates to:
  /// **'Listen'**
  String get listen;

  /// Ask human Host for a free speaker Seat
  ///
  /// In en, this message translates to:
  /// **'Raise hand'**
  String get raiseHand;

  /// Count of occupied speaking positions in a Talk
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No speaker seats} =1{1 speaker seat} other{{count} speaker seats}}'**
  String speakerSeats(int count);

  /// Display separately formatted native amount and ISO asset/currency code; formatted by locale-aware formatter, no currency conversion
  ///
  /// In en, this message translates to:
  /// **'{amount} {currency}'**
  String walletAmount(String amount, String currency);

  /// Short splash-screen subtitle describing public live human-hosted Talks with AI participants; not a transaction or private assistant claim
  ///
  /// In en, this message translates to:
  /// **'Live conversations with people and AI'**
  String get splashTagline;

  /// Authentication and onboarding visible string: welcomeTitle
  ///
  /// In en, this message translates to:
  /// **'Welcome to Masanawa'**
  String get welcomeTitle;

  /// Authentication and onboarding visible string: checkingSignInMethods
  ///
  /// In en, this message translates to:
  /// **'Checking available sign-in methods…'**
  String get checkingSignInMethods;

  /// Authentication and onboarding visible string: signInInstruction
  ///
  /// In en, this message translates to:
  /// **'Sign in with email or phone. We\'ll send you a one-time code.'**
  String get signInInstruction;

  /// Authentication and onboarding visible string: signInMethodsUnavailable
  ///
  /// In en, this message translates to:
  /// **'Sign-in is temporarily unavailable. Please try again shortly.'**
  String get signInMethodsUnavailable;

  /// Authentication and onboarding visible string: signInMethodsLoadFailed
  ///
  /// In en, this message translates to:
  /// **'Could not load sign-in methods. Check your connection and try again.'**
  String get signInMethodsLoadFailed;

  /// Authentication and onboarding visible string: invalidPhoneNumber
  ///
  /// In en, this message translates to:
  /// **'Enter a valid phone number'**
  String get invalidPhoneNumber;

  /// Authentication and onboarding visible string: invalidEmailAddress
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address'**
  String get invalidEmailAddress;

  /// Authentication and onboarding visible string: phoneMethod
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get phoneMethod;

  /// Authentication and onboarding visible string: emailMethod
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get emailMethod;

  /// Email address sample only; should not be translated as user data
  ///
  /// In en, this message translates to:
  /// **'you@example.com'**
  String get emailExample;

  /// Authentication and onboarding visible string: sendingCode
  ///
  /// In en, this message translates to:
  /// **'Sending code…'**
  String get sendingCode;

  /// Authentication and onboarding visible string: sendCode
  ///
  /// In en, this message translates to:
  /// **'Send code'**
  String get sendCode;

  /// Authentication and onboarding visible string: continueAction
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueAction;

  /// Consent copy on sign-in screen; legal terms must exist as linked documents, translation alone is not legal compliance
  ///
  /// In en, this message translates to:
  /// **'By continuing, you agree to our Terms and Privacy Policy.'**
  String get termsNotice;

  /// Authentication and onboarding visible string: otpTitle
  ///
  /// In en, this message translates to:
  /// **'Enter the code'**
  String get otpTitle;

  /// One-time code target, where identifier is the destination email or telephone; preserve identifier verbatim
  ///
  /// In en, this message translates to:
  /// **'Sent to {identifier}'**
  String otpSentTo(String identifier);

  /// Authentication and onboarding visible string: invalidOtpCode
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit verification code'**
  String get invalidOtpCode;

  /// Authentication and onboarding visible string: otpSessionExpired
  ///
  /// In en, this message translates to:
  /// **'Session expired. Please request a new code.'**
  String get otpSessionExpired;

  /// Authentication and onboarding visible string: verifyingCode
  ///
  /// In en, this message translates to:
  /// **'Verifying…'**
  String get verifyingCode;

  /// Authentication and onboarding visible string: verifyCode
  ///
  /// In en, this message translates to:
  /// **'Verify'**
  String get verifyCode;

  /// Cooldown in integer seconds; don't transform identifier or change state
  ///
  /// In en, this message translates to:
  /// **'Resend code in {seconds}s'**
  String resendCodeIn(int seconds);

  /// Authentication and onboarding visible string: resendCode
  ///
  /// In en, this message translates to:
  /// **'Resend code'**
  String get resendCode;

  /// Password setup heading for an unregistered phone number
  ///
  /// In en, this message translates to:
  /// **'Create a password'**
  String get passwordCreateTitle;

  /// Password setup confirmation heading
  ///
  /// In en, this message translates to:
  /// **'Repeat your password'**
  String get passwordConfirmTitle;

  /// Password setup explanation
  ///
  /// In en, this message translates to:
  /// **'Six digits. You will need it when you sign in on a new device.'**
  String get passwordCreateSubtitle;

  /// Password entry heading for a registered number on a new device
  ///
  /// In en, this message translates to:
  /// **'Enter your password'**
  String get passwordEnterTitle;

  /// Password entry subtitle naming the phone number
  ///
  /// In en, this message translates to:
  /// **'Six-digit password for {identifier}'**
  String passwordEnterSubtitle(String identifier);

  /// Password setup confirmation mismatch
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match. Try again.'**
  String get passwordMismatch;

  /// Password entry submit button
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get passwordSignIn;

  /// Authentication and onboarding visible string: nameQuestion
  ///
  /// In en, this message translates to:
  /// **'What should we call you?'**
  String get nameQuestion;

  /// Authentication and onboarding visible string: completeProfile
  ///
  /// In en, this message translates to:
  /// **'Complete your Masanawa profile.'**
  String get completeProfile;

  /// Authentication and onboarding visible string: codeVerifiedName
  ///
  /// In en, this message translates to:
  /// **'Your code is verified. Add your name to finish signing in.'**
  String get codeVerifiedName;

  /// Authentication and onboarding visible string: fullNameLabel
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get fullNameLabel;

  /// Example person's full name, not an account field
  ///
  /// In en, this message translates to:
  /// **'e.g. Amina Bello'**
  String get fullNameExample;

  /// Authentication and onboarding visible string: fullNameRequired
  ///
  /// In en, this message translates to:
  /// **'Please enter your full name'**
  String get fullNameRequired;

  /// Authentication and onboarding visible string: finishingSignIn
  ///
  /// In en, this message translates to:
  /// **'Finishing sign in…'**
  String get finishingSignIn;

  /// Authentication and onboarding visible string: verifiedSignInNotice
  ///
  /// In en, this message translates to:
  /// **'Your verified phone number or email remains your sign-in method.'**
  String get verifiedSignInNotice;

  /// Shows the actual detected telephone dial prefix, not a user's current country or wallet jurisdiction
  ///
  /// In en, this message translates to:
  /// **'Phone code: {code}'**
  String countryDialCode(String code);

  /// Input has no recognized international telephone prefix; do not silently assume a country
  ///
  /// In en, this message translates to:
  /// **'Phone code not recognized'**
  String get unknownCountryDialCode;

  /// Auth error text for authCodeInvalid; never infer user balances or expose raw server payload. Only surface matching known server error codes.
  ///
  /// In en, this message translates to:
  /// **'That code is incorrect. Check it and try again.'**
  String get authCodeInvalid;

  /// Auth error text for authCodeLocked; never infer user balances or expose raw server payload. Only surface matching known server error codes.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Please request a new code later.'**
  String get authCodeLocked;

  /// Auth error text for authCodeExpired; never infer user balances or expose raw server payload. Only surface matching known server error codes.
  ///
  /// In en, this message translates to:
  /// **'This code has expired. Request a new one.'**
  String get authCodeExpired;

  /// Auth error text for authRateLimited; never infer user balances or expose raw server payload. Only surface matching known server error codes.
  ///
  /// In en, this message translates to:
  /// **'Too many requests. Please try again later.'**
  String get authRateLimited;

  /// Auth error text for authSendFailed; never infer user balances or expose raw server payload. Only surface matching known server error codes.
  ///
  /// In en, this message translates to:
  /// **'Could not send the code. Check your connection and try again.'**
  String get authSendFailed;

  /// Auth error text for authVerifyFailed; never infer user balances or expose raw server payload. Only surface matching known server error codes.
  ///
  /// In en, this message translates to:
  /// **'Could not verify the code. Try again.'**
  String get authVerifyFailed;

  /// Auth error text for authProfileFailed; never infer user balances or expose raw server payload. Only surface matching known server error codes.
  ///
  /// In en, this message translates to:
  /// **'Could not finish your profile. Check your details and try again.'**
  String get authProfileFailed;

  /// Button shown on signed-out authentication screen to select the application's UI language; not voice/conversation or account region
  ///
  /// In en, this message translates to:
  /// **'App language'**
  String get languageAction;

  /// Modal bottom-sheet heading for user-selected UI language
  ///
  /// In en, this message translates to:
  /// **'Choose app language'**
  String get languageDialogTitle;

  /// Reset manual language override and follow ordered OS language preferences
  ///
  /// In en, this message translates to:
  /// **'Use device language'**
  String get languageSystem;

  /// Secure device preference could not be saved; current selection remains unchanged
  ///
  /// In en, this message translates to:
  /// **'Could not save language preference. Try again.'**
  String get languageSaveFailed;

  /// Honest notice while translating the remaining product screens
  ///
  /// In en, this message translates to:
  /// **'Some screens are not fully translated yet.'**
  String get languagePreviewNotice;

  /// Hausa cannot be selected until framework Material/Cupertino localizations and screen coverage are complete
  ///
  /// In en, this message translates to:
  /// **'Hausa interface support is being completed.'**
  String get languageHausaUnavailable;

  /// Accessible status for the selected app UI language option
  ///
  /// In en, this message translates to:
  /// **'Selected'**
  String get languageSelected;

  /// Root navigation/public Twin discovery UI: platformAgentsTab
  ///
  /// In en, this message translates to:
  /// **'Masanawa Agents'**
  String get platformAgentsTab;

  /// Root navigation/public Twin discovery UI: twinsTab
  ///
  /// In en, this message translates to:
  /// **'Twins'**
  String get twinsTab;

  /// Root navigation/public Twin discovery UI: searchPlatformAgents
  ///
  /// In en, this message translates to:
  /// **'Search Masanawa Agents'**
  String get searchPlatformAgents;

  /// Root navigation/public Twin discovery UI: clearAgentSearch
  ///
  /// In en, this message translates to:
  /// **'Clear agent search'**
  String get clearAgentSearch;

  /// Root navigation/public Twin discovery UI: agentsLoadFailed
  ///
  /// In en, this message translates to:
  /// **'Could not load agents. Try again.'**
  String get agentsLoadFailed;

  /// Root navigation/public Twin discovery UI: noPlatformAgents
  ///
  /// In en, this message translates to:
  /// **'No Masanawa Agents available yet.'**
  String get noPlatformAgents;

  /// Root navigation/public Twin discovery UI: noMatchingAgents
  ///
  /// In en, this message translates to:
  /// **'No agents match your search.'**
  String get noMatchingAgents;

  /// Root navigation/public Twin discovery UI: gwaniUnavailableRetry
  ///
  /// In en, this message translates to:
  /// **'Gwani is unavailable. Try again shortly.'**
  String get gwaniUnavailableRetry;

  /// Root navigation/public Twin discovery UI: gwaniUnavailableNow
  ///
  /// In en, this message translates to:
  /// **'Gwani is unavailable right now.'**
  String get gwaniUnavailableNow;

  /// Unavailable private Twin session. Interpolate exact user-authored Twin name, not a provider identifier.
  ///
  /// In en, this message translates to:
  /// **'Private Talk with {name} is not available yet.'**
  String privateTwinTalkUnavailable(String name);

  /// Root navigation/public Twin discovery UI: viewTwinProfile
  ///
  /// In en, this message translates to:
  /// **'View profile'**
  String get viewTwinProfile;

  /// Root navigation/public Twin discovery UI: searchTalks
  ///
  /// In en, this message translates to:
  /// **'Search Talks'**
  String get searchTalks;

  /// Root navigation/public Twin discovery UI: searchPublicTwins
  ///
  /// In en, this message translates to:
  /// **'Search public Twins'**
  String get searchPublicTwins;

  /// Root navigation/public Twin discovery UI: clearTwinSearch
  ///
  /// In en, this message translates to:
  /// **'Clear search'**
  String get clearTwinSearch;

  /// Root navigation/public Twin discovery UI: myTwin
  ///
  /// In en, this message translates to:
  /// **'My Twin'**
  String get myTwin;

  /// Root navigation/public Twin discovery UI: publicTwin
  ///
  /// In en, this message translates to:
  /// **'Public Twin'**
  String get publicTwin;

  /// Root navigation/public Twin discovery UI: noPublicTwins
  ///
  /// In en, this message translates to:
  /// **'No public Twins found.'**
  String get noPublicTwins;

  /// Root navigation/public Twin discovery UI: publicTwinsLoadFailed
  ///
  /// In en, this message translates to:
  /// **'Could not load public Twins. Try again.'**
  String get publicTwinsLoadFailed;

  /// Root navigation/public Twin discovery UI: loadMore
  ///
  /// In en, this message translates to:
  /// **'Load more'**
  String get loadMore;

  /// Root navigation/public Twin discovery UI: statusAvailable
  ///
  /// In en, this message translates to:
  /// **'Available'**
  String get statusAvailable;

  /// Root navigation/public Twin discovery UI: statusListening
  ///
  /// In en, this message translates to:
  /// **'Listening…'**
  String get statusListening;

  /// Root navigation/public Twin discovery UI: statusWorking
  ///
  /// In en, this message translates to:
  /// **'Working'**
  String get statusWorking;

  /// Root navigation/public Twin discovery UI: statusOnCall
  ///
  /// In en, this message translates to:
  /// **'On a call'**
  String get statusOnCall;

  /// Root navigation/public Twin discovery UI: statusOffline
  ///
  /// In en, this message translates to:
  /// **'Offline'**
  String get statusOffline;

  /// Important: do not equate unverified with offline or available; presence comes from server activity evidence.
  ///
  /// In en, this message translates to:
  /// **'Status unverified'**
  String get statusUnverified;

  /// Agent presence with an authoritative count of currently active tasks; count is an integer, ICU plural handles grammatical forms.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Working · 1 task} other{Working · {count} tasks}}'**
  String statusWorkingTasks(int count);

  /// Explicit share message for a public user-owned Twin; preserve exact name and canonical URL unchanged
  ///
  /// In en, this message translates to:
  /// **'Talk with {name} on Masanawa: {url}'**
  String twinShareText(String name, String url);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
    'ar',
    'en',
    'es',
    'fr',
    'ha',
    'pt',
  ].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'fr':
      return AppLocalizationsFr();
    case 'ha':
      return AppLocalizationsHa();
    case 'pt':
      return AppLocalizationsPt();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
