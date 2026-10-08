import 'package:flutter/widgets.dart';

/// Small, typed, app-owned message catalog. This is intentionally separate
/// from conversational language, account country, and financial currency.
/// Callers pass the UI locale, never a nationality or speaker-detected language.
abstract final class MasanawaStrings {
  static const _messages = <String, Map<String, String>>{
    'en': {
      'home': 'Home',
      'agents': 'Agents',
      'wallet': 'Wallet',
      'talk': 'Talk',
      'explore': 'Explore',
      'liveTalks': 'Live Talks',
      'startTalk': 'Start Talk',
      'activity': 'Activity',
      'profile': 'Profile',
      'settings': 'Settings',
      'retry': 'Try again',
      'cancel': 'Cancel',
      'confirm': 'Confirm',
      'loading': 'Loading…',
    },
    'ha': {
      'home': 'Gida',
      'agents': 'Wakilai',
      'wallet': 'Walati',
      'talk': 'Hira',
      'explore': 'Bincika',
      'liveTalks': 'Hirarraki kai tsaye',
      'startTalk': 'Fara hira',
      'activity': 'Ayyuka',
      'profile': 'Bayanan martaba',
      'settings': 'Saituna',
      'retry': 'Sake gwadawa',
      'cancel': 'Soke',
      'confirm': 'Tabbatar',
      'loading': 'Ana lodawa…',
    },
    'ar': {
      'home': 'الرئيسية',
      'agents': 'الوكلاء',
      'wallet': 'المحفظة',
      'talk': 'تحدث',
      'explore': 'استكشف',
      'liveTalks': 'محادثات مباشرة',
      'startTalk': 'ابدأ محادثة',
      'activity': 'النشاط',
      'profile': 'الملف الشخصي',
      'settings': 'الإعدادات',
      'retry': 'حاول مجددًا',
      'cancel': 'إلغاء',
      'confirm': 'تأكيد',
      'loading': 'جارٍ التحميل…',
    },
    'fr': {
      'home': 'Accueil',
      'agents': 'Agents',
      'wallet': 'Portefeuille',
      'talk': 'Parler',
      'explore': 'Explorer',
      'liveTalks': 'Discussions en direct',
      'startTalk': 'Démarrer une discussion',
      'activity': 'Activité',
      'profile': 'Profil',
      'settings': 'Paramètres',
      'retry': 'Réessayer',
      'cancel': 'Annuler',
      'confirm': 'Confirmer',
      'loading': 'Chargement…',
    },
    'es': {
      'home': 'Inicio',
      'agents': 'Agentes',
      'wallet': 'Billetera',
      'talk': 'Hablar',
      'explore': 'Explorar',
      'liveTalks': 'Charlas en vivo',
      'startTalk': 'Iniciar charla',
      'activity': 'Actividad',
      'profile': 'Perfil',
      'settings': 'Configuración',
      'retry': 'Reintentar',
      'cancel': 'Cancelar',
      'confirm': 'Confirmar',
      'loading': 'Cargando…',
    },
    'pt': {
      'home': 'Início',
      'agents': 'Agentes',
      'wallet': 'Carteira',
      'talk': 'Conversar',
      'explore': 'Explorar',
      'liveTalks': 'Conversas ao vivo',
      'startTalk': 'Iniciar conversa',
      'activity': 'Atividade',
      'profile': 'Perfil',
      'settings': 'Configurações',
      'retry': 'Tentar novamente',
      'cancel': 'Cancelar',
      'confirm': 'Confirmar',
      'loading': 'Carregando…',
    },
  };

  static String get(Locale locale, String key) =>
      _messages[locale.languageCode]?[key] ??
      _messages['en']?[key] ??
      key;

  static String of(BuildContext context, String key) =>
      get(Localizations.localeOf(context), key);
}
