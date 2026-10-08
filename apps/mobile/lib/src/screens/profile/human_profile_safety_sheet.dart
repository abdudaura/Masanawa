import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_state.dart';
import '../../talks/talk_safety.dart';
import 'human_profile_report_journal.dart';
import 'human_profile_safety_transport.dart';

class HumanProfileSafetySheet extends ConsumerStatefulWidget {
  const HumanProfileSafetySheet({
    super.key, required this.handle, required this.reporterUserId,
  });
  final String handle;
  final String reporterUserId;

  @override
  ConsumerState<HumanProfileSafetySheet> createState()=>_HumanProfileSafetySheetState();
}

class _HumanProfileSafetySheetState extends ConsumerState<HumanProfileSafetySheet> {
  final _details=TextEditingController();
  bool _loading=true;
  bool _busy=false;
  bool _blocked=false;
  bool _muted=false;
  bool _savedBlocked=false;
  bool _savedMuted=false;
  String? _error;
  String? _receipt;
  TalkSafetyReportReason? _reason;
  PendingHumanProfileReport? _pending;

  @override
  void initState(){
    super.initState();
    _load();
  }

  @override
  void dispose(){
    _details.dispose();
    super.dispose();
  }

  bool get _authorized {
    final s=ref.read(sessionProvider);
    return s is SessionSignedIn && s.user.id==widget.reporterUserId &&
      s.user.isActive;
  }

  Future<void> _load() async {
    if(!_authorized){
      if(mounted)setState((){
        _loading=false;
        _error='Sign in to manage this profile.';
      });
      return;
    }
    setState((){
      _loading=true;
      _error=null;
    });
    try {
      final pref=await ref.read(humanProfileSafetyTransportProvider).read(widget.handle);
      final pending=await ref.read(humanProfileReportJournalProvider).read(
        widget.reporterUserId,widget.handle,
      );
      if(!mounted || !_authorized)return;
      setState((){
        _blocked=pref.blocked;
        _muted=pref.muted;
        _savedBlocked=pref.blocked;
        _savedMuted=pref.muted;
        _pending=pending;
        _reason=pending?.reason;
        _details.text=pending?.detail ?? '';
        _loading=false;
      });
    }catch(_){
      if(!mounted || !_authorized)return;
      setState((){
        _loading=false;
        _error='Couldn’t read your safety settings. Check connection and retry.';
      });
    }
  }

  Future<void> _save() async {
    if(_busy || !_authorized || _loading)return;
    setState((){_busy=true;_error=null;});
    try {
      final requestedBlocked=_blocked;
      final requestedMuted=_muted;
      final transport=ref.read(humanProfileSafetyTransportProvider);
      await transport.set(widget.handle,blocked:requestedBlocked,muted:requestedMuted);
      // A 2xx alone is not an authoritative settings readback.
      final saved=await transport.read(widget.handle);
      if(!mounted || !_authorized)return;
      setState((){
        _savedBlocked=saved.blocked;
        _savedMuted=saved.muted;
        _blocked=saved.blocked;
        _muted=saved.muted;
        if(saved.blocked!=requestedBlocked || saved.muted!=requestedMuted){
          _error='Server settings changed. Review before saving again.';
        }
      });
    }catch(_){
      if(!mounted || !_authorized)return;
      setState((){
        _error='Change not confirmed. Reload to check actual server settings.';
      });
    }finally{
      if(mounted)setState(()=>_busy=false);
    }
  }

  Future<void> _report() async {
    if(_busy || _loading || !_authorized || _receipt!=null)return;
    if(_pending==null && _reason==null){
      setState(()=>_error='Select a reason for your report.');
      return;
    }
    setState((){
      _busy=true;
      _error=null;
    });
    try {
      var pending=_pending;
      if(pending==null){
        pending=PendingHumanProfileReport(
          requestId:PendingHumanProfileReport.freshId(),
          reason:_reason!,
          detail:_details.text.trim(),
          createdAt:DateTime.now().toUtc(),
        );
        // Durable before dispatch: crash or timeout must reuse this same ID.
        await ref.read(humanProfileReportJournalProvider).write(
          widget.reporterUserId,widget.handle,pending,
        );
        if(!mounted || !_authorized)return;
        setState(()=>_pending=pending);
      }
      if(!_authorized)return;
      final receipt=await ref.read(humanProfileSafetyTransportProvider).report(
        widget.handle,
        reason:pending.reason,
        requestId:pending.requestId,
        detail:pending.detail,
      );
      if(!mounted || !_authorized)return;
      setState(()=>_receipt=receipt);
      // If clear fails, saved pending is safe to replay; backend deduplicates.
      try {
        await ref.read(humanProfileReportJournalProvider).clear(
          widget.reporterUserId,widget.handle,
        );
        if(mounted && _authorized)setState(()=>_pending=null);
      }catch(_){}
    }catch(_){
      if(!mounted || !_authorized)return;
      setState((){
        _error=_pending==null
          ? 'Unable to save a safe retry. Nothing was sent.'
          : 'Outcome not confirmed. Retry sends the same report ID.';
      });
    }finally{
      if(mounted)setState(()=>_busy=false);
    }
  }

  @override
  Widget build(BuildContext context){
    final current=ref.watch(sessionProvider);
    final valid=current is SessionSignedIn &&
      current.user.id==widget.reporterUserId && current.user.isActive;
    final canEdit=valid && !_loading && !_busy;
    final frozen=_pending!=null || _receipt!=null;
    return SafeArea(
      child:Padding(
        padding:EdgeInsets.fromLTRB(
          20,16,20,20+MediaQuery.of(context).viewInsets.bottom,
        ),
        child:SingleChildScrollView(
          child:Column(
            mainAxisSize:MainAxisSize.min,
            crossAxisAlignment:CrossAxisAlignment.stretch,
            children:[
              Text('Safety for @${widget.handle}',
                style:Theme.of(context).textTheme.titleLarge),
              const SizedBox(height:8),
              const Text('Block or mute this person, or privately report a concern.'),
              if(!valid)
                const Padding(
                  padding:EdgeInsets.symmetric(vertical:14),
                  child:Text('Your account changed. Close and sign in again.'),
                )
              else if(_loading)
                const Padding(
                  padding:EdgeInsets.all(20),
                  child:Center(child:CircularProgressIndicator()),
                )
              else ...[
                SwitchListTile.adaptive(
                  key:const ValueKey('human-safety-block'),
                  title:const Text('Block this person'),
                  subtitle:const Text('Hide and restrict interactions.'),
                  value:_blocked,
                  onChanged:canEdit?(value)=>setState(()=>_blocked=value):null,
                ),
                SwitchListTile.adaptive(
                  key:const ValueKey('human-safety-mute'),
                  title:const Text('Mute this person'),
                  subtitle:const Text('Reduce their public updates.'),
                  value:_muted,
                  onChanged:canEdit?(value)=>setState(()=>_muted=value):null,
                ),
                if(_blocked!=_savedBlocked || _muted!=_savedMuted)
                  FilledButton(
                    key:const ValueKey('human-safety-save'),
                    onPressed:canEdit?_save:null,
                    child:const Text('Save safety settings'),
                  ),
                const Divider(height:28),
                const Text('Report this profile',
                  style:TextStyle(fontWeight:FontWeight.w700)),
                const SizedBox(height:10),
                DropdownButtonFormField<TalkSafetyReportReason>(
                  key:const ValueKey('human-safety-reason'),
                  value:_reason,
                  decoration:const InputDecoration(labelText:'Reason'),
                  items:[
                    for(final reason in TalkSafetyReportReason.values)
                      DropdownMenuItem(value:reason,child:Text(reason.label)),
                  ],
                  onChanged:canEdit && !frozen
                    ?(value)=>setState(()=>_reason=value):null,
                ),
                const SizedBox(height:8),
                TextField(
                  key:const ValueKey('human-safety-detail'),
                  controller:_details,
                  enabled:canEdit && !frozen,
                  minLines:2,
                  maxLines:4,
                  maxLength:2000,
                  decoration:const InputDecoration(
                    labelText:'Details (optional)',
                    hintText:'What happened?',
                  ),
                ),
                if(frozen && _receipt==null)
                  const Text(
                    'An earlier report may have reached moderation. Retrying uses the original request.',
                  ),
                if(_receipt!=null)
                  const Text(
                    'Report accepted for review. This does not automatically block the person.',
                    key:ValueKey('human-safety-accepted'),
                  )
                else
                  FilledButton.tonal(
                    key:const ValueKey('human-safety-report'),
                    onPressed:canEdit?_report:null,
                    child:Text(frozen?'Retry same report':'Submit private report'),
                  ),
              ],
              if(_error!=null) ...[
                const SizedBox(height:12),
                Text(_error!,key:const ValueKey('human-safety-error')),
                TextButton(
                  onPressed:valid && !_busy?_load:null,
                  child:const Text('Reload settings'),
                ),
              ],
              const SizedBox(height:10),
              TextButton(
                onPressed:()=>Navigator.of(context).pop(),
                child:const Text('Close'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
