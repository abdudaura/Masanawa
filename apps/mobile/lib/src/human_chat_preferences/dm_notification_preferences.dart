import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

enum DmMuteMode { off, until, forever }
enum DmPreviewMode { hidden, generic }
enum DmPreferenceState { idle, loading, ready, saving, conflict, uncertain, forbidden, error }

@immutable
class DmNotificationSettings {
  const DmNotificationSettings({required this.conversationId,required this.version,
    required this.mute,required this.preview,this.until});
  final String conversationId;
  final int version;
  final DmMuteMode mute;
  final DmPreviewMode preview;
  final DateTime? until;
  factory DmNotificationSettings.fromJson(Map<String,dynamic> data) {
    final id=data['conversationId'], version=data['version'];
    if(id is! String || !RegExp(r'^[0-9a-fA-F-]{36}$').hasMatch(id)
        || version is! int || version<0 || data['muteMode'] is! String || data['preview'] is! String){
      throw const FormatException('Invalid notification settings response');
    }
    final mute=DmMuteMode.values.byName(data['muteMode'] as String);
    final preview=DmPreviewMode.values.byName(data['preview'] as String);
    final raw=data['mutedUntil'];
    if(raw!=null && raw is! String)throw const FormatException('Invalid expiry');
    final until=raw==null?null:DateTime.tryParse(raw);
    if(raw!=null && until==null)throw const FormatException('Invalid expiry');
    if((mute==DmMuteMode.until)!=(until!=null))throw const FormatException('Invalid mute state');
    return DmNotificationSettings(conversationId:id,version:version,mute:mute,until:until,preview:preview);
  }
  Map<String,dynamic> change({required DmMuteMode mute,required DmPreviewMode preview,DateTime? until}) => {
    'expectedVersion':version,'muteMode':mute.name,'preview':preview.name,
    if(mute==DmMuteMode.until)'mutedUntil':until?.toUtc().toIso8601String(),
  };
}
abstract class DmNotificationTransport {
  Future<DmNotificationSettings> get({required String authorizationHeader,required String conversationId});
  Future<DmNotificationSettings> put({required String authorizationHeader,required DmNotificationSettings existing,
    required DmMuteMode mute,required DmPreviewMode preview,DateTime? until});
  Future<bool> canOpen({required String authorizationHeader,required String conversationId});
}
/** Uses the existing authenticated Gateway Dio; no customer bearer written to disk. */
class DioDmNotificationTransport implements DmNotificationTransport {
  DioDmNotificationTransport(this.dio);
  final Dio dio;
  Options headers(String auth)=>Options(headers:{'authorization':auth,'cache-control':'no-store'});
  String path(String id)=>'/messages/'+Uri.encodeComponent(id)+'/notification-preferences';
  @override
  Future<DmNotificationSettings> get({required String authorizationHeader,required String conversationId})async{
    final r=await dio.get<dynamic>(path(conversationId),options:headers(authorizationHeader));
    return DmNotificationSettings.fromJson(Map<String,dynamic>.from(r.data as Map));
  }
  @override
  Future<DmNotificationSettings> put({required String authorizationHeader,required DmNotificationSettings existing,
    required DmMuteMode mute,required DmPreviewMode preview,DateTime? until})async{
    final r=await dio.put<dynamic>(path(existing.conversationId),
      data:existing.change(mute:mute,preview:preview,until:until),options:headers(authorizationHeader));
    return DmNotificationSettings.fromJson(Map<String,dynamic>.from(r.data as Map));
  }
  @override
  Future<bool> canOpen({required String authorizationHeader,required String conversationId})async{
    try{
      final r=await dio.get<dynamic>('/messages/'+Uri.encodeComponent(conversationId)+'/notification-target',
        options:headers(authorizationHeader));
      return r.data is Map && r.data['conversationId']==conversationId;
    }on DioException catch(e){
      if([401,403,404].contains(e.response?.statusCode))return false;
      rethrow;
    }
  }
}
/** Ephemeral per-session controller; stale account requests cannot update a new account. */
class DmNotificationPreferencesController extends ChangeNotifier {
  DmNotificationPreferencesController(this.transport);
  final DmNotificationTransport transport;
  DmNotificationSettings? current;
  DmPreferenceState state=DmPreferenceState.idle;
  String? errorCode;
  String? _scope;
  int _generation=0;
  bool forbidden(Object e)=>e is DioException && [401,403,404].contains(e.response?.statusCode);
  Future<void> load({required String accountKey,required String authorizationHeader,required String conversationId})async{
    final gen=++_generation;
    _scope=accountKey+':'+conversationId;
    current=null;errorCode=null;state=DmPreferenceState.loading;notifyListeners();
    try{
      final result=await transport.get(authorizationHeader:authorizationHeader,conversationId:conversationId);
      if(gen!=_generation)return;
      if(result.conversationId!=conversationId)throw const FormatException('Wrong conversation');
      current=result;state=DmPreferenceState.ready;
    }catch(e){
      if(gen!=_generation)return;
      current=null;state=forbidden(e)?DmPreferenceState.forbidden:DmPreferenceState.error;
      errorCode='Unable to load current notification settings';
    }
    notifyListeners();
  }
  Future<void> save({required String accountKey,required String authorizationHeader,required String conversationId,
    required DmMuteMode mute,required DmPreviewMode preview,DateTime? until})async{
    final original=current;
    if(original==null || state!=DmPreferenceState.ready || _scope!=accountKey+':'+conversationId)return;
    final gen=++_generation;
    state=DmPreferenceState.saving;errorCode=null;notifyListeners();
    try{
      final result=await transport.put(authorizationHeader:authorizationHeader,existing:original,mute:mute,preview:preview,until:until);
      if(gen!=_generation)return;
      if(result.conversationId!=conversationId || result.version<=original.version)throw const FormatException('Unconfirmed write');
      current=result;state=DmPreferenceState.ready;
    }catch(e){
      if(gen!=_generation)return;
      current=null;
      state=forbidden(e)?DmPreferenceState.forbidden:
        (e is DioException && e.response?.statusCode==409)?DmPreferenceState.conflict:DmPreferenceState.uncertain;
      errorCode=state==DmPreferenceState.conflict?'Updated on another device. Reload before editing.':
        'Save was not confirmed. Reload authoritative state before retrying.';
    }
    notifyListeners();
  }
  void clear(){++_generation;_scope=null;current=null;errorCode=null;state=DmPreferenceState.idle;notifyListeners();}
  @override
  void dispose(){++_generation;super.dispose();}
}
