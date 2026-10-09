import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/session_state.dart';
import '../../talks/talk_safety.dart';
import 'human_profile_report_journal.dart';
import 'human_profile_report_transport.dart';

/// Private human-profile reporting only. Block/mute are intentionally not
/// exposed here until their cross-surface server enforcement is qualified.
class HumanProfileReportSheet extends ConsumerStatefulWidget {
  const HumanProfileReportSheet({
    super.key,required this.handle,required this.reporterUserId,
  });
  final String handle;
  final String reporterUserId;

  @override
  ConsumerState<HumanProfileReportSheet> createState()=>_HumanProfileReportSheetState();
}

class _HumanProfileReportSheetState extends ConsumerState<HumanProfileReportSheet> {
  final _details=TextEditingController();
  bool _loading=true;
  bool _busy=false;
  String? _error;
  String? _receipt;
  TalkSafetyReportReason? _reason;
  PendingHumanProfileReport? _pending;

  bool get _authorized {
    final state=ref.read(sessionProvider);
    return state is SessionSignedIn &&
      state.user.id==widget.reporterUserId && state.user.isActive;
  }

  @override
  void initState(){
    super.initState();
    _recover();
  }

  @override
  void dispose(){
    _details.dispose();
    super.dispose();
  }

  Future<void> _recover() async {
    if(!_authorized){
      if(mounted)setState((){
        _loading=false;
        _error='Sign in before reporting a profile.';
      });
      return;
    }
    setState((){
      _loading=true;
      _error=null;
    });
    try {
      final pending=await ref.read(humanProfileReportJournalProvider).read(
        widget.reporterUserId,widget.handle,
      );
      if(!mounted || !_authorized)return;
      setState((){
        _pending=pending;
        _reason=pending?.reason;
        _details.text=pending?.detail ?? '';
        _loading=false;
      });
    } catch(_) {
      if(!mounted || !_authorized)return;
      setState((){
        _loading=false;
        _error='Secure report recovery is unavailable. No report can be sent. Try again.';
      });
    }
  }

  Future<void> _send() async {
    if(_busy || _loading || !_authorized || _receipt!=null)return;
    if(_reason==null && _pending==null){
      setState(()=>_error='Choose a report reason.');
      return;
    }
    // A failed journal read may hide an earlier possibly-committed report.
    if(_error?.contains('recovery is unavailable')==true)return;
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
        // Write encrypted retry state before the first uncertain HTTP send.
        await ref.read(humanProfileReportJournalProvider).write(
          widget.reporterUserId,widget.handle,pending,
        );
        if(!mounted || !_authorized)return;
        setState(()=>_pending=pending);
      }
      if(!_authorized)return;
      final receipt=await ref.read(humanProfileReportTransportProvider).report(
        widget.handle,
        reason:pending.reason,
        requestId:pending.requestId,
        detail:pending.detail,
        reporterUserId:widget.reporterUserId,
      );
      if(!mounted || !_authorized)return;
      setState(()=>_receipt=receipt);
      try {
        await ref.read(humanProfileReportJournalProvider).clear(
          widget.reporterUserId,widget.handle,
        );
        if(mounted && _authorized)setState(()=>_pending=null);
      } catch (_) {
        // Confirmed acceptance still wins. Reopening will replay the same ID.
      }
    } catch (_) {
      if(!mounted || !_authorized)return;
      setState(()=>_error=_pending==null
        ? 'No report sent: secure journal failed. Try again.'
        : 'Outcome not confirmed. Retry will reuse the previous report ID.');
    } finally {
      if(mounted)setState(()=>_busy=false);
    }
  }

  @override
  Widget build(BuildContext context){
    ref.listen<SessionState>(sessionProvider,(before,after){
      final previous=before is SessionSignedIn &&
        before.user.id==widget.reporterUserId && before.user.isActive;
      final current=after is SessionSignedIn &&
        after.user.id==widget.reporterUserId && after.user.isActive;
      if(!previous && current){
        WidgetsBinding.instance.addPostFrameCallback((_){
          if(mounted)_recover();
        });
      }
    });
    final state=ref.watch(sessionProvider);
    final authorized=state is SessionSignedIn &&
      state.user.id==widget.reporterUserId && state.user.isActive;
    final frozen=_pending!=null || _receipt!=null;
    final canSend=authorized && !_loading && !_busy &&
      _error?.contains('recovery is unavailable')!=true;
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
              Text('Report @${widget.handle}',
                style:Theme.of(context).textTheme.titleLarge),
              const SizedBox(height:8),
              const Text('Reports are private and submitted to the moderation team. Reporting does not automatically block an account.'),
              if(!authorized)
                const Padding(
                  padding:EdgeInsets.symmetric(vertical:14),
                  child:Text('Your account changed. Close or sign in again.'),
                )
              else if(_loading)
                const Padding(
                  padding:EdgeInsets.all(20),
                  child:Center(child:CircularProgressIndicator()),
                )
              else ...[
                const SizedBox(height:14),
                DropdownButtonFormField<TalkSafetyReportReason>(
                  key:const ValueKey('human-safety-reason'),
                  value:_reason,
                  decoration:const InputDecoration(labelText:'Reason'),
                  items:[
                    for(final reason in TalkSafetyReportReason.values)
                      DropdownMenuItem(value:reason,child:Text(reason.label)),
                  ],
                  onChanged:canSend && !frozen
                    ?(value)=>setState(()=>_reason=value):null,
                ),
                const SizedBox(height:8),
                TextField(
                  key:const ValueKey('human-safety-detail'),
                  controller:_details,
                  enabled:canSend && !frozen,
                  minLines:2,
                  maxLines:4,
                  maxLength:2000,
                  decoration:const InputDecoration(
                    labelText:'Details (optional)',
                    hintText:'Describe what happened',
                  ),
                ),
                if(_pending!=null && _receipt==null)
                  const Text(
                    'A previous send may have succeeded. Retrying will use its original ID.',
                  ),
                if(_receipt!=null)
                  const Text(
                    'Report accepted for review.',
                    key:ValueKey('human-safety-accepted'),
                  )
                else
                  FilledButton(
                    key:const ValueKey('human-safety-report'),
                    onPressed:canSend?_send:null,
                    child:Text(frozen?'Retry same report':'Submit report'),
                  ),
              ],
              if(_error!=null) ...[
                const SizedBox(height:12),
                Text(_error!,key:const ValueKey('human-safety-error')),
                TextButton(
                  onPressed:authorized && !_busy?_recover:null,
                  child:const Text('Recover pending report'),
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
