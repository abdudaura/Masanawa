// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appTitle => 'Masanawa';

  @override
  String get home => 'Accueil';

  @override
  String get agents => 'Agents';

  @override
  String get wallet => 'Portefeuille';

  @override
  String get talk => 'Parler';

  @override
  String get chats => 'Chats';

  @override
  String get status => 'Status';

  @override
  String get calls => 'Calls';

  @override
  String get rooms => 'Rooms';

  @override
  String get explore => 'Explorer';

  @override
  String get liveTalks => 'Discussions en direct';

  @override
  String get startTalk => 'Démarrer une discussion';

  @override
  String get activity => 'Activité';

  @override
  String get profile => 'Profil';

  @override
  String get settings => 'Paramètres';

  @override
  String get retry => 'Réessayer';

  @override
  String get cancel => 'Annuler';

  @override
  String get confirm => 'Confirmer';

  @override
  String get loading => 'Chargement…';

  @override
  String get listen => 'Écouter';

  @override
  String get raiseHand => 'Lever la main';

  @override
  String speakerSeats(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sièges d\'intervenant',
      one: '1 siège d\'intervenant',
      zero: 'Aucun siège d\'intervenant',
    );
    return '$_temp0';
  }

  @override
  String walletAmount(String amount, String currency) {
    return '$amount $currency';
  }

  @override
  String get splashTagline => 'Conversations en direct entre humains et IA';

  @override
  String get welcomeTitle => 'Bienvenue sur Masanawa';

  @override
  String get checkingSignInMethods => 'Vérification des méthodes de connexion…';

  @override
  String get signInInstruction =>
      'Connectez-vous par e-mail ou téléphone. Nous vous enverrons un code à usage unique.';

  @override
  String get signInMethodsUnavailable =>
      'La connexion est temporairement indisponible. Réessayez dans un instant.';

  @override
  String get signInMethodsLoadFailed =>
      'Impossible de charger les méthodes de connexion. Vérifiez votre connexion et réessayez.';

  @override
  String get invalidPhoneNumber => 'Saisissez un numéro de téléphone valide';

  @override
  String get invalidEmailAddress => 'Saisissez une adresse e-mail valide';

  @override
  String get phoneMethod => 'Téléphone';

  @override
  String get emailMethod => 'E-mail';

  @override
  String get emailExample => 'vous@exemple.fr';

  @override
  String get sendingCode => 'Envoi du code…';

  @override
  String get sendCode => 'Envoyer le code';

  @override
  String get continueAction => 'Continuer';

  @override
  String get termsNotice =>
      'En continuant, vous acceptez nos Conditions d’utilisation et notre Politique de confidentialité.';

  @override
  String get otpTitle => 'Saisissez le code';

  @override
  String otpSentTo(String identifier) {
    return 'Envoyé à $identifier';
  }

  @override
  String get invalidOtpCode => 'Saisissez le code de vérification à 6 chiffres';

  @override
  String get otpSessionExpired =>
      'La session a expiré. Demandez un nouveau code.';

  @override
  String get verifyingCode => 'Vérification…';

  @override
  String get verifyCode => 'Vérifier';

  @override
  String resendCodeIn(int seconds) {
    return 'Renvoyer le code dans $seconds s';
  }

  @override
  String get resendCode => 'Renvoyer le code';

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
  String get nameQuestion => 'Comment devons-nous vous appeler ?';

  @override
  String get completeProfile => 'Complétez votre profil Masanawa.';

  @override
  String get codeVerifiedName =>
      'Votre code est vérifié. Ajoutez votre nom pour terminer la connexion.';

  @override
  String get fullNameLabel => 'Nom complet';

  @override
  String get fullNameExample => 'Ex. : Amina Bello';

  @override
  String get fullNameRequired => 'Veuillez saisir votre nom complet';

  @override
  String get finishingSignIn => 'Finalisation de la connexion…';

  @override
  String get verifiedSignInNotice =>
      'Votre numéro de téléphone ou adresse e-mail vérifié reste votre moyen de connexion.';

  @override
  String countryDialCode(String code) {
    return 'Indicatif téléphonique : $code';
  }

  @override
  String get unknownCountryDialCode => 'Indicatif téléphonique non reconnu';

  @override
  String get authCodeInvalid =>
      'Ce code est incorrect. Vérifiez-le et réessayez.';

  @override
  String get authCodeLocked =>
      'Trop de tentatives. Demandez un nouveau code plus tard.';

  @override
  String get authCodeExpired => 'Ce code a expiré. Demandez-en un nouveau.';

  @override
  String get authRateLimited => 'Trop de demandes. Réessayez plus tard.';

  @override
  String get authSendFailed =>
      'Impossible d’envoyer le code. Vérifiez votre connexion et réessayez.';

  @override
  String get authVerifyFailed => 'Impossible de vérifier le code. Réessayez.';

  @override
  String get authProfileFailed =>
      'Impossible de terminer votre profil. Vérifiez vos informations et réessayez.';

  @override
  String get languageAction => 'Langue de l’application';

  @override
  String get languageDialogTitle => 'Choisir la langue de l’application';

  @override
  String get languageSystem => 'Utiliser la langue de l’appareil';

  @override
  String get languageSaveFailed =>
      'Impossible d’enregistrer la langue. Réessayez.';

  @override
  String get languagePreviewNotice =>
      'Certaines pages ne sont pas encore entièrement traduites.';

  @override
  String get languageHausaUnavailable =>
      'La traduction de l’interface en haoussa est en cours.';

  @override
  String get languageSelected => 'Sélectionné';

  @override
  String get platformAgentsTab => 'Agents Masanawa';

  @override
  String get twinsTab => 'Twins';

  @override
  String get searchPlatformAgents => 'Rechercher des agents Masanawa';

  @override
  String get clearAgentSearch => 'Effacer la recherche d’agents';

  @override
  String get agentsLoadFailed => 'Impossible de charger les agents. Réessayez.';

  @override
  String get noPlatformAgents =>
      'Aucun agent Masanawa disponible pour le moment.';

  @override
  String get noMatchingAgents => 'Aucun agent ne correspond à votre recherche.';

  @override
  String get gwaniUnavailableRetry =>
      'Gwani est indisponible. Réessayez dans un instant.';

  @override
  String get gwaniUnavailableNow => 'Gwani est indisponible pour le moment.';

  @override
  String privateTwinTalkUnavailable(String name) {
    return 'La conversation privée avec $name n’est pas encore disponible.';
  }

  @override
  String get viewTwinProfile => 'Voir le profil';

  @override
  String get searchTalks => 'Rechercher des discussions';

  @override
  String get searchPublicTwins => 'Rechercher des Twins publics';

  @override
  String get clearTwinSearch => 'Effacer la recherche';

  @override
  String get myTwin => 'Mon Twin';

  @override
  String get publicTwin => 'Twin public';

  @override
  String get noPublicTwins => 'Aucun Twin public trouvé.';

  @override
  String get publicTwinsLoadFailed =>
      'Impossible de charger les Twins publics. Réessayez.';

  @override
  String get loadMore => 'Charger plus';

  @override
  String get statusAvailable => 'Disponible';

  @override
  String get statusListening => 'À l’écoute…';

  @override
  String get statusWorking => 'Au travail';

  @override
  String get statusOnCall => 'En appel';

  @override
  String get statusOffline => 'Hors ligne';

  @override
  String get statusUnverified => 'Statut non vérifié';

  @override
  String statusWorkingTasks(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Au travail · $count tâches',
      one: 'Au travail · 1 tâche',
    );
    return '$_temp0';
  }

  @override
  String twinShareText(String name, String url) {
    return 'Discutez avec $name sur Masanawa : $url';
  }
}
