// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appTitle => 'Masanawa';

  @override
  String get home => 'Início';

  @override
  String get agents => 'Agentes';

  @override
  String get wallet => 'Carteira';

  @override
  String get talk => 'Conversar';

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
  String get liveTalks => 'Conversas ao vivo';

  @override
  String get startTalk => 'Iniciar conversa';

  @override
  String get activity => 'Atividade';

  @override
  String get profile => 'Perfil';

  @override
  String get settings => 'Configurações';

  @override
  String get retry => 'Tentar novamente';

  @override
  String get cancel => 'Cancelar';

  @override
  String get confirm => 'Confirmar';

  @override
  String get loading => 'Carregando…';

  @override
  String get listen => 'Ouvir';

  @override
  String get raiseHand => 'Levantar a mão';

  @override
  String speakerSeats(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count lugares de fala',
      one: '1 lugar de fala',
      zero: 'Nenhum lugar de fala',
    );
    return '$_temp0';
  }

  @override
  String walletAmount(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get splashTagline => 'Conversas ao vivo entre pessoas e IA';

  @override
  String get welcomeTitle => 'Boas-vindas ao Masanawa';

  @override
  String get checkingSignInMethods => 'Verificando os métodos de acesso…';

  @override
  String get signInInstruction =>
      'Entre com seu e-mail ou telefone. Enviaremos um código de uso único.';

  @override
  String get signInMethodsUnavailable =>
      'O acesso está temporariamente indisponível. Tente novamente em instantes.';

  @override
  String get signInMethodsLoadFailed =>
      'Não foi possível carregar os métodos de acesso. Verifique sua conexão e tente novamente.';

  @override
  String get invalidPhoneNumber => 'Digite um número de telefone válido';

  @override
  String get invalidEmailAddress => 'Digite um endereço de e-mail válido';

  @override
  String get phoneMethod => 'Telefone';

  @override
  String get emailMethod => 'E-mail';

  @override
  String get emailExample => 'voce@exemplo.com';

  @override
  String get sendingCode => 'Enviando código…';

  @override
  String get sendCode => 'Enviar código';

  @override
  String get continueAction => 'Continuar';

  @override
  String get termsNotice =>
      'Ao continuar, você concorda com nossos Termos e nossa Política de Privacidade.';

  @override
  String get otpTitle => 'Digite o código';

  @override
  String otpSentTo(String identifier) {
    return 'Enviado para $identifier';
  }

  @override
  String get invalidOtpCode => 'Digite o código de verificação de 6 dígitos';

  @override
  String get otpSessionExpired => 'A sessão expirou. Solicite um novo código.';

  @override
  String get verifyingCode => 'Verificando…';

  @override
  String get verifyCode => 'Verificar';

  @override
  String resendCodeIn(int seconds) {
    return 'Reenviar código em $seconds s';
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
  String get nameQuestion => 'Como devemos chamar você?';

  @override
  String get completeProfile => 'Complete seu perfil no Masanawa.';

  @override
  String get codeVerifiedName =>
      'Seu código foi verificado. Adicione seu nome para concluir o acesso.';

  @override
  String get fullNameLabel => 'Nome completo';

  @override
  String get fullNameExample => 'Ex.: Amina Bello';

  @override
  String get fullNameRequired => 'Digite seu nome completo';

  @override
  String get finishingSignIn => 'Concluindo o acesso…';

  @override
  String get verifiedSignInNotice =>
      'Seu telefone ou e-mail verificado continuará sendo seu método de acesso.';

  @override
  String countryDialCode(String code) {
    return 'Código telefônico: $code';
  }

  @override
  String get unknownCountryDialCode => 'Código telefônico não reconhecido';

  @override
  String get authCodeInvalid =>
      'O código está incorreto. Confira e tente novamente.';

  @override
  String get authCodeLocked =>
      'Muitas tentativas. Solicite um novo código mais tarde.';

  @override
  String get authCodeExpired => 'Este código expirou. Solicite um novo.';

  @override
  String get authRateLimited =>
      'Muitas solicitações. Tente novamente mais tarde.';

  @override
  String get authSendFailed =>
      'Não foi possível enviar o código. Verifique a conexão e tente novamente.';

  @override
  String get authVerifyFailed =>
      'Não foi possível verificar o código. Tente novamente.';

  @override
  String get authProfileFailed =>
      'Não foi possível concluir seu perfil. Verifique seus dados e tente novamente.';

  @override
  String get languageAction => 'Idioma do aplicativo';

  @override
  String get languageDialogTitle => 'Escolher idioma do aplicativo';

  @override
  String get languageSystem => 'Usar idioma do dispositivo';

  @override
  String get languageSaveFailed =>
      'Não foi possível salvar a preferência de idioma. Tente novamente.';

  @override
  String get languagePreviewNotice =>
      'Algumas telas ainda não estão totalmente traduzidas.';

  @override
  String get languageHausaUnavailable =>
      'O suporte à interface em hauçá está sendo concluído.';

  @override
  String get languageSelected => 'Selecionado';

  @override
  String get platformAgentsTab => 'Agentes Masanawa';

  @override
  String get searchPlatformAgents => 'Buscar agentes Masanawa';

  @override
  String get clearAgentSearch => 'Limpar busca de agentes';

  @override
  String get agentsLoadFailed =>
      'Não foi possível carregar os agentes. Tente novamente.';

  @override
  String get noPlatformAgents => 'Ainda não há agentes Masanawa disponíveis.';

  @override
  String get noMatchingAgents => 'Nenhum agente corresponde à sua busca.';

  @override
  String get gwaniUnavailableRetry =>
      'Gwani não está disponível. Tente novamente em instantes.';

  @override
  String get gwaniUnavailableNow => 'Gwani não está disponível agora.';

  @override
  String get searchTalks => 'Buscar conversas';

  @override
  String get loadMore => 'Carregar mais';

  @override
  String get statusAvailable => 'Disponível';

  @override
  String get statusListening => 'Ouvindo…';

  @override
  String get statusWorking => 'Trabalhando';

  @override
  String get statusOnCall => 'Em chamada';

  @override
  String get statusOffline => 'Desconectado';

  @override
  String get statusUnverified => 'Status não verificado';

  @override
  String statusWorkingTasks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Trabalhando · $count tarefas',
      one: 'Trabalhando · 1 tarefa',
    );
    return '$_temp0';
  }
}
