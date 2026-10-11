// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Spanish Castilian (`es`).
class AppLocalizationsEs extends AppLocalizations {
  AppLocalizationsEs([String locale = 'es']) : super(locale);

  @override
  String get appTitle => 'Masanawa';

  @override
  String get home => 'Inicio';

  @override
  String get agents => 'Agentes';

  @override
  String get wallet => 'Billetera';

  @override
  String get talk => 'Hablar';

  @override
  String get chats => 'Chats';

  @override
  String get status => 'Status';

  @override
  String get calls => 'Calls';

  @override
  String get rooms => 'Rooms';

  @override
  String get explore => 'Explorar';

  @override
  String get liveTalks => 'Charlas en vivo';

  @override
  String get startTalk => 'Iniciar charla';

  @override
  String get activity => 'Actividad';

  @override
  String get profile => 'Perfil';

  @override
  String get settings => 'Configuración';

  @override
  String get retry => 'Reintentar';

  @override
  String get cancel => 'Cancelar';

  @override
  String get confirm => 'Confirmar';

  @override
  String get loading => 'Cargando…';

  @override
  String get listen => 'Escuchar';

  @override
  String get raiseHand => 'Levantar la mano';

  @override
  String speakerSeats(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count asientos para hablar',
      one: '1 asiento para hablar',
      zero: 'No hay asientos para hablar',
    );
    return '$_temp0';
  }

  @override
  String walletAmount(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get splashTagline => 'Conversaciones en vivo entre personas e IA';

  @override
  String get welcomeTitle => 'Te damos la bienvenida a Masanawa';

  @override
  String get checkingSignInMethods =>
      'Comprobando los métodos de inicio de sesión…';

  @override
  String get signInInstruction =>
      'Inicia sesión con tu correo o teléfono. Te enviaremos un código de un solo uso.';

  @override
  String get signInMethodsUnavailable =>
      'El inicio de sesión no está disponible temporalmente. Inténtalo de nuevo en unos momentos.';

  @override
  String get signInMethodsLoadFailed =>
      'No se pudieron cargar los métodos de inicio de sesión. Comprueba tu conexión e inténtalo de nuevo.';

  @override
  String get invalidPhoneNumber => 'Introduce un número de teléfono válido';

  @override
  String get invalidEmailAddress => 'Introduce una dirección de correo válida';

  @override
  String get phoneMethod => 'Teléfono';

  @override
  String get emailMethod => 'Correo';

  @override
  String get emailExample => 'tu@ejemplo.com';

  @override
  String get sendingCode => 'Enviando código…';

  @override
  String get sendCode => 'Enviar código';

  @override
  String get continueAction => 'Continuar';

  @override
  String get termsNotice =>
      'Al continuar, aceptas nuestros Términos y Política de privacidad.';

  @override
  String get otpTitle => 'Introduce el código';

  @override
  String otpSentTo(String identifier) {
    return 'Enviado a $identifier';
  }

  @override
  String get invalidOtpCode =>
      'Introduce el código de verificación de 6 dígitos';

  @override
  String get otpSessionExpired =>
      'La sesión ha caducado. Solicita un código nuevo.';

  @override
  String get verifyingCode => 'Verificando…';

  @override
  String get verifyCode => 'Verificar';

  @override
  String resendCodeIn(int seconds) {
    return 'Reenviar código en $seconds s';
  }

  @override
  String get resendCode => 'Reenviar código';

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
  String get nameQuestion => '¿Cómo quieres que te llamemos?';

  @override
  String get completeProfile => 'Completa tu perfil de Masanawa.';

  @override
  String get codeVerifiedName =>
      'Tu código está verificado. Añade tu nombre para completar el inicio de sesión.';

  @override
  String get fullNameLabel => 'Nombre completo';

  @override
  String get fullNameExample => 'Ej.: Amina Bello';

  @override
  String get fullNameRequired => 'Introduce tu nombre completo';

  @override
  String get finishingSignIn => 'Finalizando inicio de sesión…';

  @override
  String get verifiedSignInNotice =>
      'El teléfono o correo verificado seguirá siendo tu método de inicio de sesión.';

  @override
  String countryDialCode(String code) {
    return 'Prefijo telefónico: $code';
  }

  @override
  String get unknownCountryDialCode => 'No se reconoce el prefijo telefónico';

  @override
  String get authCodeInvalid =>
      'El código es incorrecto. Compruébalo e inténtalo de nuevo.';

  @override
  String get authCodeLocked =>
      'Demasiados intentos. Solicita un código nuevo más tarde.';

  @override
  String get authCodeExpired => 'Este código ha caducado. Solicita uno nuevo.';

  @override
  String get authRateLimited =>
      'Demasiadas solicitudes. Inténtalo de nuevo más tarde.';

  @override
  String get authSendFailed =>
      'No se pudo enviar el código. Comprueba tu conexión e inténtalo de nuevo.';

  @override
  String get authVerifyFailed =>
      'No se pudo verificar el código. Inténtalo de nuevo.';

  @override
  String get authProfileFailed =>
      'No se pudo completar tu perfil. Comprueba tus datos e inténtalo de nuevo.';

  @override
  String get languageAction => 'Idioma de la aplicación';

  @override
  String get languageDialogTitle => 'Elegir idioma de la aplicación';

  @override
  String get languageSystem => 'Usar el idioma del dispositivo';

  @override
  String get languageSaveFailed =>
      'No se pudo guardar el idioma. Inténtalo de nuevo.';

  @override
  String get languagePreviewNotice =>
      'Algunas pantallas todavía no están completamente traducidas.';

  @override
  String get languageHausaUnavailable =>
      'Se está completando la interfaz en hausa.';

  @override
  String get languageSelected => 'Seleccionado';

  @override
  String get platformAgentsTab => 'Agentes de Masanawa';

  @override
  String get searchPlatformAgents => 'Buscar agentes de Masanawa';

  @override
  String get clearAgentSearch => 'Borrar búsqueda de agentes';

  @override
  String get agentsLoadFailed =>
      'No se pudieron cargar los agentes. Inténtalo de nuevo.';

  @override
  String get noPlatformAgents =>
      'Todavía no hay agentes de Masanawa disponibles.';

  @override
  String get noMatchingAgents =>
      'No hay agentes que coincidan con tu búsqueda.';

  @override
  String get gwaniUnavailableRetry =>
      'Gwani no está disponible. Vuelve a intentarlo pronto.';

  @override
  String get gwaniUnavailableNow => 'Gwani no está disponible ahora.';

  @override
  String get searchTalks => 'Buscar charlas';

  @override
  String get loadMore => 'Cargar más';

  @override
  String get statusAvailable => 'Disponible';

  @override
  String get statusListening => 'Escuchando…';

  @override
  String get statusWorking => 'Trabajando';

  @override
  String get statusOnCall => 'En llamada';

  @override
  String get statusOffline => 'Sin conexión';

  @override
  String get statusUnverified => 'Estado sin verificar';

  @override
  String statusWorkingTasks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Trabajando · $count tareas',
      one: 'Trabajando · 1 tarea',
    );
    return '$_temp0';
  }
}
