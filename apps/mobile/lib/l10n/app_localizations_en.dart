// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Masanawa';

  @override
  String get home => 'Home';

  @override
  String get agents => 'Agents';

  @override
  String get wallet => 'Wallet';

  @override
  String get talk => 'Talk';

  @override
  String get explore => 'Explore';

  @override
  String get liveTalks => 'Live Talks';

  @override
  String get startTalk => 'Start Talk';

  @override
  String get activity => 'Activity';

  @override
  String get profile => 'Profile';

  @override
  String get settings => 'Settings';

  @override
  String get retry => 'Try again';

  @override
  String get cancel => 'Cancel';

  @override
  String get confirm => 'Confirm';

  @override
  String get loading => 'Loading…';

  @override
  String get listen => 'Listen';

  @override
  String get raiseHand => 'Raise hand';

  @override
  String speakerSeats(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count speaker seats',
      one: '1 speaker seat',
      zero: 'No speaker seats',
    );
    return '$_temp0';
  }

  @override
  String walletAmount(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get splashTagline => 'Live conversations with people and AI';

  @override
  String get welcomeTitle => 'Welcome to Masanawa';

  @override
  String get checkingSignInMethods => 'Checking available sign-in methods…';

  @override
  String get signInInstruction =>
      'Sign in with email or phone. We\'ll send you a one-time code.';

  @override
  String get signInMethodsUnavailable =>
      'Sign-in is temporarily unavailable. Please try again shortly.';

  @override
  String get signInMethodsLoadFailed =>
      'Could not load sign-in methods. Check your connection and try again.';

  @override
  String get invalidPhoneNumber => 'Enter a valid phone number';

  @override
  String get invalidEmailAddress => 'Enter a valid email address';

  @override
  String get phoneMethod => 'Phone';

  @override
  String get emailMethod => 'Email';

  @override
  String get emailExample => 'you@example.com';

  @override
  String get sendingCode => 'Sending code…';

  @override
  String get sendCode => 'Send code';

  @override
  String get continueAction => 'Continue';

  @override
  String get termsNotice =>
      'By continuing, you agree to our Terms and Privacy Policy.';

  @override
  String get otpTitle => 'Enter the code';

  @override
  String otpSentTo(String identifier) {
    return 'Sent to $identifier';
  }

  @override
  String get invalidOtpCode => 'Enter the 6-digit verification code';

  @override
  String get otpSessionExpired => 'Session expired. Please request a new code.';

  @override
  String get verifyingCode => 'Verifying…';

  @override
  String get verifyCode => 'Verify';

  @override
  String resendCodeIn(int seconds) {
    return 'Resend code in ${seconds}s';
  }

  @override
  String get resendCode => 'Resend code';

  @override
  String get nameQuestion => 'What should we call you?';

  @override
  String get completeProfile => 'Complete your Masanawa profile.';

  @override
  String get codeVerifiedName =>
      'Your code is verified. Add your name to finish signing in.';

  @override
  String get fullNameLabel => 'Full name';

  @override
  String get fullNameExample => 'e.g. Amina Bello';

  @override
  String get fullNameRequired => 'Please enter your full name';

  @override
  String get finishingSignIn => 'Finishing sign in…';

  @override
  String get verifiedSignInNotice =>
      'Your verified phone number or email remains your sign-in method.';

  @override
  String countryDialCode(String code) {
    return 'Phone code: $code';
  }

  @override
  String get unknownCountryDialCode => 'Phone code not recognized';

  @override
  String get authCodeInvalid =>
      'That code is incorrect. Check it and try again.';

  @override
  String get authCodeLocked =>
      'Too many attempts. Please request a new code later.';

  @override
  String get authCodeExpired => 'This code has expired. Request a new one.';

  @override
  String get authRateLimited => 'Too many requests. Please try again later.';

  @override
  String get authSendFailed =>
      'Could not send the code. Check your connection and try again.';

  @override
  String get authVerifyFailed => 'Could not verify the code. Try again.';

  @override
  String get authProfileFailed =>
      'Could not finish your profile. Check your details and try again.';

  @override
  String get languageAction => 'App language';

  @override
  String get languageDialogTitle => 'Choose app language';

  @override
  String get languageSystem => 'Use device language';

  @override
  String get languageSaveFailed =>
      'Could not save language preference. Try again.';

  @override
  String get languagePreviewNotice =>
      'Some screens are not fully translated yet.';

  @override
  String get languageHausaUnavailable =>
      'Hausa interface support is being completed.';

  @override
  String get languageSelected => 'Selected';

  @override
  String get platformAgentsTab => 'Masanawa Agents';

  @override
  String get twinsTab => 'Twins';

  @override
  String get searchPlatformAgents => 'Search Masanawa Agents';

  @override
  String get clearAgentSearch => 'Clear agent search';

  @override
  String get agentsLoadFailed => 'Could not load agents. Try again.';

  @override
  String get noPlatformAgents => 'No Masanawa Agents available yet.';

  @override
  String get noMatchingAgents => 'No agents match your search.';

  @override
  String get gwaniUnavailableRetry =>
      'Gwani is unavailable. Try again shortly.';

  @override
  String get gwaniUnavailableNow => 'Gwani is unavailable right now.';

  @override
  String privateTwinTalkUnavailable(String name) {
    return 'Private Talk with $name is not available yet.';
  }

  @override
  String get viewTwinProfile => 'View profile';

  @override
  String get searchTalks => 'Search Talks';

  @override
  String get searchPublicTwins => 'Search public Twins';

  @override
  String get clearTwinSearch => 'Clear search';

  @override
  String get myTwin => 'My Twin';

  @override
  String get publicTwin => 'Public Twin';

  @override
  String get noPublicTwins => 'No public Twins found.';

  @override
  String get publicTwinsLoadFailed => 'Could not load public Twins. Try again.';

  @override
  String get loadMore => 'Load more';

  @override
  String get statusAvailable => 'Available';

  @override
  String get statusListening => 'Listening…';

  @override
  String get statusWorking => 'Working';

  @override
  String get statusOnCall => 'On a call';

  @override
  String get statusOffline => 'Offline';

  @override
  String get statusUnverified => 'Status unverified';

  @override
  String statusWorkingTasks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Working · $count tasks',
      one: 'Working · 1 task',
    );
    return '$_temp0';
  }

  @override
  String twinShareText(String name, String url) {
    return 'Talk with $name on Masanawa: $url';
  }

  @override
  String get talksTab => 'Talks';

  @override
  String get chatsTab => 'Chats';

  @override
  String get assistantTab => 'Assistant';

  @override
  String get billingRecent => 'Recent bills';

  @override
  String get billingRefreshHistory => 'Refresh history';

  @override
  String get billingNoPayments => 'No bill payments yet';

  @override
  String get billingRecipientLabel => 'Recipient';

  @override
  String get billingServiceAmountLabel => 'Service';

  @override
  String get billingFeeLabel => 'Fee';

  @override
  String get billingTotalLabel => 'Total';

  @override
  String get billingStatusLabel => 'Status';

  @override
  String get billingProviderRef => 'Provider ref';

  @override
  String get billingTokenLabel => 'Token / code';

  @override
  String get billingRefundedInfo => 'The verified payment was refunded.';

  @override
  String get billingSuccess => 'Bill completed successfully.';

  @override
  String get billingStatusQuoted => 'Quote ready';

  @override
  String get billingStatusAwaiting => 'Awaiting payment';

  @override
  String get billingStatusFunded => 'Payment verified';

  @override
  String get billingStatusProcessing => 'Processing';

  @override
  String get billingStatusCompleted => 'Completed';

  @override
  String get billingStatusRefundProcessing => 'Refund processing';

  @override
  String get billingStatusRefunded => 'Refunded';

  @override
  String get billingStatusExpired => 'Expired';

  @override
  String get billingStatusFailed => 'Failed';

  @override
  String get billingStatusAwaitingFunds => 'Awaiting funds';

  @override
  String get billingStatusUnknown => 'Status unavailable';

  @override
  String get billingTitle => 'Bills & payments';

  @override
  String get billingNew => 'New bill';

  @override
  String get billingPayTitle => 'Pay a bill';

  @override
  String get billingInstructions =>
      'Choose a live provider service. Payment is completed from your Masanawa wallet inside the app.';

  @override
  String get billingCategory => 'Category';

  @override
  String get billingProvider => 'Provider';

  @override
  String get billingService => 'Service';

  @override
  String get billingPhone => 'Phone number';

  @override
  String get billingRecipient => 'Customer / meter / smartcard number';

  @override
  String get billingAmount => 'Amount (NGN)';

  @override
  String get billingVariableHelp => 'Enter the provider-supported amount.';

  @override
  String get billingFixedHelp => 'Fixed by the provider.';

  @override
  String get billingReview => 'Review quote';

  @override
  String billingConfirmWallet(String amount) {
    return 'Confirm $amount from wallet';
  }

  @override
  String billingAddFunds(String amount) {
    return 'Add $amount';
  }

  @override
  String get billingTransferInstructions =>
      'Transfer the exact amount below. Masanawa will continue this bill automatically after the transfer is verified.';

  @override
  String get billingExpires => 'Expires:';

  @override
  String get billingRefresh => 'Refresh status';

  @override
  String get billingAnother => 'Pay another bill';

  @override
  String get billingUnavailable => 'Billing is unavailable right now.';

  @override
  String get billingProvidersUnavailable => 'Could not load providers.';

  @override
  String get billingServicesUnavailable => 'Could not load services.';

  @override
  String get billingSelectionRequired =>
      'Choose a category, provider and service.';

  @override
  String get billingInvalidDetails =>
      'Enter valid recipient details and amount.';

  @override
  String get billingQuoteFailed => 'Could not create this quote.';

  @override
  String get billingPurchaseFailed =>
      'Could not complete this purchase from your wallet.';

  @override
  String get billingRefreshFailed => 'Could not refresh status.';

  @override
  String get billingDetailsFailed => 'Could not load bill details.';

  @override
  String get billingSignInAgain => 'Your session has expired. Sign in again.';

  @override
  String get billingExpiredTryAgain =>
      'This quote has expired. Request a new quote.';
}
