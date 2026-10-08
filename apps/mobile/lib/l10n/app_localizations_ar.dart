// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'Masanawa';

  @override
  String get home => 'الرئيسية';

  @override
  String get agents => 'الوكلاء';

  @override
  String get wallet => 'المحفظة';

  @override
  String get talk => 'تحدث';

  @override
  String get explore => 'استكشف';

  @override
  String get liveTalks => 'محادثات مباشرة';

  @override
  String get startTalk => 'ابدأ محادثة';

  @override
  String get activity => 'النشاط';

  @override
  String get profile => 'الملف الشخصي';

  @override
  String get settings => 'الإعدادات';

  @override
  String get retry => 'حاول مجددًا';

  @override
  String get cancel => 'إلغاء';

  @override
  String get confirm => 'تأكيد';

  @override
  String get loading => 'جارٍ التحميل…';

  @override
  String get listen => 'استمع';

  @override
  String get raiseHand => 'ارفع يدك';

  @override
  String speakerSeats(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count مقعد للمتحدثين',
      many: '$count مقعدًا للمتحدثين',
      few: '$count مقاعد للمتحدثين',
      two: 'مقعدان للمتحدثين',
      one: 'مقعد واحد للمتحدث',
      zero: 'لا توجد مقاعد للمتحدثين',
    );
    return '$_temp0';
  }

  @override
  String walletAmount(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get splashTagline => 'محادثات مباشرة تجمع الناس والذكاء الاصطناعي';

  @override
  String get welcomeTitle => 'مرحبًا بك في Masanawa';

  @override
  String get checkingSignInMethods => 'جارٍ التحقق من طرق تسجيل الدخول…';

  @override
  String get signInInstruction =>
      'سجّل الدخول بالبريد الإلكتروني أو الهاتف. سنرسل إليك رمزًا يُستخدم مرة واحدة.';

  @override
  String get signInMethodsUnavailable =>
      'تسجيل الدخول غير متاح مؤقتًا. يُرجى المحاولة بعد قليل.';

  @override
  String get signInMethodsLoadFailed =>
      'تعذّر تحميل طرق تسجيل الدخول. تحقق من اتصالك وأعد المحاولة.';

  @override
  String get invalidPhoneNumber => 'أدخل رقم هاتف صالحًا';

  @override
  String get invalidEmailAddress => 'أدخل عنوان بريد إلكتروني صالحًا';

  @override
  String get phoneMethod => 'الهاتف';

  @override
  String get emailMethod => 'البريد الإلكتروني';

  @override
  String get emailExample => 'you@example.com';

  @override
  String get sendingCode => 'جارٍ إرسال الرمز…';

  @override
  String get sendCode => 'إرسال الرمز';

  @override
  String get continueAction => 'متابعة';

  @override
  String get termsNotice =>
      'بالمتابعة، فإنك توافق على الشروط وسياسة الخصوصية لدينا.';

  @override
  String get otpTitle => 'أدخل الرمز';

  @override
  String otpSentTo(String identifier) {
    return 'تم الإرسال إلى $identifier';
  }

  @override
  String get invalidOtpCode => 'أدخل رمز التحقق المكوّن من 6 أرقام';

  @override
  String get otpSessionExpired => 'انتهت صلاحية الجلسة. يُرجى طلب رمز جديد.';

  @override
  String get verifyingCode => 'جارٍ التحقق…';

  @override
  String get verifyCode => 'تحقق';

  @override
  String resendCodeIn(int seconds) {
    return 'إعادة إرسال الرمز بعد $seconds ث';
  }

  @override
  String get resendCode => 'إعادة إرسال الرمز';

  @override
  String get nameQuestion => 'بأي اسم نناديك؟';

  @override
  String get completeProfile => 'أكمل ملفك الشخصي في Masanawa.';

  @override
  String get codeVerifiedName =>
      'تم التحقق من الرمز. أضف اسمك لإكمال تسجيل الدخول.';

  @override
  String get fullNameLabel => 'الاسم الكامل';

  @override
  String get fullNameExample => 'مثال: أمينة بيلو';

  @override
  String get fullNameRequired => 'يُرجى إدخال اسمك الكامل';

  @override
  String get finishingSignIn => 'جارٍ إكمال تسجيل الدخول…';

  @override
  String get verifiedSignInNotice =>
      'سيظل رقم هاتفك أو بريدك الإلكتروني الذي تم التحقق منه وسيلة تسجيل دخولك.';

  @override
  String countryDialCode(String code) {
    return 'رمز اتصال الهاتف: $code';
  }

  @override
  String get unknownCountryDialCode => 'لم يتم التعرف على رمز اتصال الهاتف';

  @override
  String get authCodeInvalid => 'الرمز غير صحيح. تحقق منه وحاول مجددًا.';

  @override
  String get authCodeLocked => 'محاولات كثيرة جدًا. يُرجى طلب رمز جديد لاحقًا.';

  @override
  String get authCodeExpired => 'انتهت صلاحية هذا الرمز. اطلب رمزًا جديدًا.';

  @override
  String get authRateLimited => 'طلبات كثيرة جدًا. يُرجى المحاولة لاحقًا.';

  @override
  String get authSendFailed =>
      'تعذّر إرسال الرمز. تحقق من اتصالك وحاول مجددًا.';

  @override
  String get authVerifyFailed => 'تعذّر التحقق من الرمز. حاول مجددًا.';

  @override
  String get authProfileFailed =>
      'تعذّر إكمال ملفك الشخصي. تحقق من بياناتك وحاول مجددًا.';

  @override
  String get languageAction => 'لغة التطبيق';

  @override
  String get languageDialogTitle => 'اختر لغة التطبيق';

  @override
  String get languageSystem => 'استخدام لغة الجهاز';

  @override
  String get languageSaveFailed => 'تعذّر حفظ تفضيل اللغة. حاول مجددًا.';

  @override
  String get languagePreviewNotice => 'بعض الشاشات لم تُترجم بالكامل بعد.';

  @override
  String get languageHausaUnavailable =>
      'جارٍ استكمال دعم واجهة التطبيق باللغة الهوساوية.';

  @override
  String get languageSelected => 'محدد';

  @override
  String get platformAgentsTab => 'وكلاء Masanawa';

  @override
  String get twinsTab => 'التوائم';

  @override
  String get searchPlatformAgents => 'ابحث عن وكلاء Masanawa';

  @override
  String get clearAgentSearch => 'مسح بحث الوكلاء';

  @override
  String get agentsLoadFailed => 'تعذّر تحميل الوكلاء. حاول مجددًا.';

  @override
  String get noPlatformAgents => 'لا يوجد وكلاء Masanawa متاحون حاليًا.';

  @override
  String get noMatchingAgents => 'لا يوجد وكلاء يطابقون بحثك.';

  @override
  String get gwaniUnavailableRetry => 'Gwani غير متاح. حاول مجددًا بعد قليل.';

  @override
  String get gwaniUnavailableNow => 'Gwani غير متاح الآن.';

  @override
  String privateTwinTalkUnavailable(String name) {
    return 'المحادثة الخاصة مع $name غير متاحة بعد.';
  }

  @override
  String get viewTwinProfile => 'عرض الملف الشخصي';

  @override
  String get searchTalks => 'البحث في المحادثات';

  @override
  String get searchPublicTwins => 'البحث عن التوائم العامة';

  @override
  String get clearTwinSearch => 'مسح البحث';

  @override
  String get myTwin => 'توأمي';

  @override
  String get publicTwin => 'توأم عام';

  @override
  String get noPublicTwins => 'لم يتم العثور على توائم عامة.';

  @override
  String get publicTwinsLoadFailed =>
      'تعذّر تحميل التوائم العامة. حاول مجددًا.';

  @override
  String get loadMore => 'تحميل المزيد';

  @override
  String get statusAvailable => 'متاح';

  @override
  String get statusListening => 'يستمع…';

  @override
  String get statusWorking => 'يعمل';

  @override
  String get statusOnCall => 'في مكالمة';

  @override
  String get statusOffline => 'غير متصل';

  @override
  String get statusUnverified => 'الحالة غير مؤكدة';

  @override
  String statusWorkingTasks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'يعمل · $count مهمة',
      many: 'يعمل · $count مهمة',
      few: 'يعمل · $count مهام',
      two: 'يعمل · مهمتان',
      one: 'يعمل · مهمة واحدة',
    );
    return '$_temp0';
  }

  @override
  String twinShareText(String name, String url) {
    return 'تحدث مع $name على Masanawa: $url';
  }

  @override
  String get talksTab => 'نقاشات';

  @override
  String get chatsTab => 'دردشات';

  @override
  String get assistantTab => 'المساعد';

  @override
  String get billingRecent => 'الفواتير الأخيرة';

  @override
  String get billingRefreshHistory => 'تحديث السجل';

  @override
  String get billingNoPayments => 'لا توجد مدفوعات فواتير بعد';

  @override
  String get billingRecipientLabel => 'المستفيد';

  @override
  String get billingServiceAmountLabel => 'الخدمة';

  @override
  String get billingFeeLabel => 'الرسوم';

  @override
  String get billingTotalLabel => 'الإجمالي';

  @override
  String get billingStatusLabel => 'الحالة';

  @override
  String get billingProviderRef => 'مرجع المزود';

  @override
  String get billingTokenLabel => 'الرمز / التوكن';

  @override
  String get billingRefundedInfo => 'تم رد المبلغ المدفوع بعد التحقق منه.';

  @override
  String get billingSuccess => 'اكتمل دفع الفاتورة بنجاح.';

  @override
  String get billingStatusQuoted => 'عرض السعر جاهز';

  @override
  String get billingStatusAwaiting => 'بانتظار الدفع';

  @override
  String get billingStatusFunded => 'تم التحقق من الدفع';

  @override
  String get billingStatusProcessing => 'قيد المعالجة';

  @override
  String get billingStatusCompleted => 'مكتمل';

  @override
  String get billingStatusRefundProcessing => 'جارٍ رد المبلغ';

  @override
  String get billingStatusRefunded => 'تم رد المبلغ';

  @override
  String get billingStatusExpired => 'منتهي الصلاحية';

  @override
  String get billingStatusFailed => 'فشل';

  @override
  String get billingStatusAwaitingFunds => 'بانتظار التمويل';

  @override
  String get billingStatusUnknown => 'الحالة غير متاحة';

  @override
  String get billingTitle => 'الفواتير والمدفوعات';

  @override
  String get billingNew => 'فاتورة جديدة';

  @override
  String get billingPayTitle => 'دفع فاتورة';

  @override
  String get billingInstructions =>
      'اختر خدمة متاحة من المزود. يتم الدفع من محفظة Masanawa داخل التطبيق.';

  @override
  String get billingCategory => 'الفئة';

  @override
  String get billingProvider => 'المزود';

  @override
  String get billingService => 'الخدمة';

  @override
  String get billingPhone => 'رقم الهاتف';

  @override
  String get billingRecipient => 'رقم العميل / العداد / البطاقة';

  @override
  String get billingAmount => 'المبلغ (NGN)';

  @override
  String get billingVariableHelp => 'أدخل مبلغًا يدعمه المزود.';

  @override
  String get billingFixedHelp => 'المبلغ ثابت لدى المزود.';

  @override
  String get billingReview => 'مراجعة عرض السعر';

  @override
  String billingConfirmWallet(String amount) {
    return 'تأكيد $amount من المحفظة';
  }

  @override
  String billingAddFunds(String amount) {
    return 'إضافة $amount';
  }

  @override
  String get billingTransferInstructions =>
      'حوّل المبلغ المحدد أدناه. ستتابع Masanawa دفع الفاتورة تلقائيًا بعد التحقق من التحويل.';

  @override
  String get billingExpires => 'تنتهي الصلاحية:';

  @override
  String get billingRefresh => 'تحديث الحالة';

  @override
  String get billingAnother => 'دفع فاتورة أخرى';

  @override
  String get billingUnavailable => 'خدمة دفع الفواتير غير متاحة الآن.';

  @override
  String get billingProvidersUnavailable => 'تعذر تحميل المزودين.';

  @override
  String get billingServicesUnavailable => 'تعذر تحميل الخدمات.';

  @override
  String get billingSelectionRequired => 'اختر الفئة والمزود والخدمة.';

  @override
  String get billingInvalidDetails => 'أدخل بيانات المستفيد والمبلغ بشكل صحيح.';

  @override
  String get billingQuoteFailed => 'تعذر إنشاء عرض السعر.';

  @override
  String get billingPurchaseFailed => 'تعذر إكمال الشراء من محفظتك.';

  @override
  String get billingRefreshFailed => 'تعذر تحديث الحالة.';

  @override
  String get billingDetailsFailed => 'تعذر تحميل تفاصيل الفاتورة.';

  @override
  String get billingSignInAgain => 'انتهت جلستك. سجّل الدخول مجددًا.';

  @override
  String get billingExpiredTryAgain => 'انتهت صلاحية العرض. اطلب عرضًا جديدًا.';
}
