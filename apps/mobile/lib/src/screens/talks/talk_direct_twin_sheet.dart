import 'package:flutter/material.dart';
import '../../talks/talk_direct_twin.dart';

Future<void> showDirectTwinSheet(
  BuildContext context, {
  required String talkId,
  required List<DirectTwinSeat> seats,
  required DirectTwinTransport transport,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _DirectTwinSheet(talkId:talkId,seats:seats,transport:transport),
  );
}

class _DirectTwinSheet extends StatefulWidget {
  const _DirectTwinSheet({required this.talkId,required this.seats,required this.transport});
  final String talkId;
  final List<DirectTwinSeat> seats;
  final DirectTwinTransport transport;
  @override State<_DirectTwinSheet> createState()=>_DirectTwinSheetState();
}

class _DirectTwinSheetState extends State<_DirectTwinSheet> {
  late DirectTwinSeat _seat=widget.seats.first;
  DirectTwinInstruction? _current;
  final _controller=TextEditingController();
  bool _busy=false;
  Object? _error;
  static const _quick=['Challenge that','Ask for evidence','Defend my position','Be more concise','Stop agreeing','Push the strongest counterargument'];
  @override void initState(){super.initState();_load();}
  @override void dispose(){_controller.dispose();super.dispose();}
  Future<void> _load() async {
    setState(()=>_error=null);
    try {
      final value=await widget.transport.load(talkId:widget.talkId,seatId:_seat.seatId);
      if(!mounted)return; setState(() { _current=value; _controller.text=value.instruction??''; });
    } catch(e){if(mounted)setState(()=>_error=e);}
  }
  Future<void> _save([String? quick]) async {
    final text=(quick??_controller.text).trim(); if(text.isEmpty||_busy)return;
    setState(()=>_busy=true);
    try {
      final value=await widget.transport.set(talkId:widget.talkId,seatId:_seat.seatId,revision:_current?.revision??0,instruction:text);
      if(!mounted)return; setState((){_current=value;_controller.text=value.instruction??'';});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Twin direction updated.')));
    } catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Couldn’t update your Twin right now.')));}
    finally{if(mounted)setState(()=>_busy=false);}
  }
  Future<void> _clear() async {
    final current=_current; if(current==null||current.revision==0||_busy)return;
    setState(()=>_busy=true);
    try {
      final value=await widget.transport.clear(talkId:widget.talkId,seatId:_seat.seatId,revision:current.revision);
      if(!mounted)return; setState((){_current=value;_controller.clear();});
    } catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Couldn’t clear the direction.')));}
    finally{if(mounted)setState(()=>_busy=false);}
  }
  @override Widget build(BuildContext context){
    return Padding(
      padding:EdgeInsets.fromLTRB(18,16,18,18+MediaQuery.viewInsetsOf(context).bottom),
      child:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        const Text('Direct Twin',style:TextStyle(fontSize:19,fontWeight:FontWeight.w800)),
        const SizedBox(height:4),
        const Text('Private guidance for your Twin’s next turns. It expires automatically.'),
        if(widget.seats.length>1)...[
          const SizedBox(height:12),
          DropdownButtonFormField<DirectTwinSeat>(
            value:_seat,
            items:[for(final seat in widget.seats) DropdownMenuItem(value:seat,child:Text(seat.personaId))],
            onChanged:_busy?null:(value){if(value!=null){setState(()=>_seat=value);_load();}},
            decoration:const InputDecoration(labelText:'Twin Seat'),
          ),
        ],
        const SizedBox(height:12),
        if(_error!=null) TextButton(onPressed:_load,child:const Text('Couldn’t load direction. Try again'))
        else Wrap(spacing:8,runSpacing:8,children:[for(final item in _quick) ActionChip(label:Text(item),onPressed:_busy?null:()=>_save(item))]),
        const SizedBox(height:12),
        TextField(controller:_controller,maxLength:2000,maxLines:3,decoration:const InputDecoration(hintText:'Tell your Twin what to emphasize next')),
        const SizedBox(height:8),
        FilledButton(onPressed:_busy?null:_save,child:Text(_busy?'Updating…':'Update direction')),
        if((_current?.instruction??'').isNotEmpty) TextButton(onPressed:_busy?null:_clear,child:const Text('Clear direction')),
      ])),
    );
  }
}
