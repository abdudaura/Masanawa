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
  String get twinsTab => 'Gêmeos';

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
  String privateTwinTalkUnavailable(String name) {
    return 'A conversa privada com $name ainda não está disponível.';
  }

  @override
  String get viewTwinProfile => 'Ver perfil';

  @override
  String get searchTalks => 'Buscar conversas';

  @override
  String get searchPublicTwins => 'Buscar gêmeos públicos';

  @override
  String get clearTwinSearch => 'Limpar busca';

  @override
  String get myTwin => 'Meu gêmeo';

  @override
  String get publicTwin => 'Gêmeo público';

  @override
  String get noPublicTwins => 'Nenhum gêmeo público encontrado.';

  @override
  String get publicTwinsLoadFailed =>
      'Não foi possível carregar gêmeos públicos. Tente novamente.';

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

  @override
  String twinShareText(String name, String url) {
    return 'Converse com $name no Masanawa: $url';
  }

  @override
  String get talksTab => 'Conversas';

  @override
  String get chatsTab => 'Chats';

  @override
  String get assistantTab => 'Assistente';

  @override
  String get billingRecent => 'Pagamentos recentes';

  @override
  String get billingRefreshHistory => 'Atualizar histórico';

  @override
  String get billingNoPayments => 'Nenhum pagamento ainda';

  @override
  String get billingRecipientLabel => 'Destinatário';

  @override
  String get billingServiceAmountLabel => 'Serviço';

  @override
  String get billingFeeLabel => 'Taxa';

  @override
  String get billingTotalLabel => 'Total';

  @override
  String get billingStatusLabel => 'Status';

  @override
  String get billingProviderRef => 'Referência do fornecedor';

  @override
  String get billingTokenLabel => 'Token / código';

  @override
  String get billingRefundedInfo => 'O pagamento verificado foi reembolsado.';

  @override
  String get billingSuccess => 'Conta paga com sucesso.';

  @override
  String get billingStatusQuoted => 'Cotação pronta';

  @override
  String get billingStatusAwaiting => 'Aguardando pagamento';

  @override
  String get billingStatusFunded => 'Pagamento confirmado';

  @override
  String get billingStatusProcessing => 'Processando';

  @override
  String get billingStatusCompleted => 'Concluído';

  @override
  String get billingStatusRefundProcessing => 'Reembolso em andamento';

  @override
  String get billingStatusRefunded => 'Reembolsado';

  @override
  String get billingStatusExpired => 'Expirado';

  @override
  String get billingStatusFailed => 'Falhou';

  @override
  String get billingStatusAwaitingFunds => 'Aguardando fundos';

  @override
  String get billingStatusUnknown => 'Status indisponível';

  @override
  String get billingTitle => 'Contas e pagamentos';

  @override
  String get billingNew => 'Nova conta';

  @override
  String get billingPayTitle => 'Pagar uma conta';

  @override
  String get billingInstructions =>
      'Escolha um serviço disponível. O pagamento é feito pela sua carteira Masanawa no aplicativo.';

  @override
  String get billingCategory => 'Categoria';

  @override
  String get billingProvider => 'Fornecedor';

  @override
  String get billingService => 'Serviço';

  @override
  String get billingPhone => 'Número de telefone';

  @override
  String get billingRecipient => 'Número do cliente / medidor / cartão';

  @override
  String get billingAmount => 'Valor (NGN)';

  @override
  String get billingVariableHelp => 'Informe um valor aceito pelo fornecedor.';

  @override
  String get billingFixedHelp => 'Valor fixado pelo fornecedor.';

  @override
  String get billingReview => 'Revisar cotação';

  @override
  String billingConfirmWallet(String amount) {
    return 'Confirmar $amount pela carteira';
  }

  @override
  String billingAddFunds(String amount) {
    return 'Adicionar $amount';
  }

  @override
  String get billingTransferInstructions =>
      'Transfira o valor exato abaixo. A Masanawa continuará o pagamento automaticamente após confirmar a transferência.';

  @override
  String get billingExpires => 'Expira em:';

  @override
  String get billingRefresh => 'Atualizar status';

  @override
  String get billingAnother => 'Pagar outra conta';

  @override
  String get billingUnavailable => 'Pagamentos indisponíveis no momento.';

  @override
  String get billingProvidersUnavailable =>
      'Não foi possível carregar os fornecedores.';

  @override
  String get billingServicesUnavailable =>
      'Não foi possível carregar os serviços.';

  @override
  String get billingSelectionRequired =>
      'Escolha categoria, fornecedor e serviço.';

  @override
  String get billingInvalidDetails => 'Informe dados e valor válidos.';

  @override
  String get billingQuoteFailed => 'Não foi possível criar a cotação.';

  @override
  String get billingPurchaseFailed =>
      'Não foi possível concluir a compra pela carteira.';

  @override
  String get billingRefreshFailed => 'Não foi possível atualizar o status.';

  @override
  String get billingDetailsFailed =>
      'Não foi possível carregar os detalhes da conta.';

  @override
  String get billingSignInAgain => 'Sua sessão expirou. Entre novamente.';

  @override
  String get billingExpiredTryAgain => 'Esta cotação expirou. Solicite outra.';
}
