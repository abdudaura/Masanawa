import 'package:flutter/material.dart';
import 'selected_message_assist.dart';

/// Nested human-Chats action sheet, not a new root tab or AI-in-human-DM member.
class SelectedMessageAssistSheet extends StatefulWidget {
  const SelectedMessageAssistSheet({
    super.key, required this.controller, required this.recipientLabel,
    this.language='ha',
  });
  final SelectedMessageAssistController controller;
  final String recipientLabel, language;
  @override
  State<SelectedMessageAssistSheet> createState()=>_SelectedMessageAssistSheetState();
}
class _SelectedMessageAssistSheetState extends State<SelectedMessageAssistSheet> {
  HumanAiAssistPurpose purpose=HumanAiAssistPurpose.reply;
  bool disclosed=false, maskPrivateNumbers=true, reviewedRecipient=false;
  late final TextEditingController draft;
  @override
  void initState() {
    super.initState();
    draft=TextEditingController();
    widget.controller.addListener(_onChange);
  }
  void _onChange() {
    if (!mounted) return;
    // A new AI suggestion/discard is never approved by an older checkbox.
    if (widget.controller.phase==HumanAiAssistPhase.preparing ||
        widget.controller.phase==HumanAiAssistPhase.choose) {
      reviewedRecipient=false;
    }
    if (widget.controller.phase==HumanAiAssistPhase.choose) disclosed=false;
    if (widget.controller.phase==HumanAiAssistPhase.review &&
        draft.text!=widget.controller.reviewedText) {
      draft.value=TextEditingValue(text:widget.controller.reviewedText,
        selection:TextSelection.collapsed(offset:widget.controller.reviewedText.length));
    }
    setState(() {});
  }
  @override
  void dispose() {
    widget.controller.removeListener(_onChange);
    draft.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) {
    final c=widget.controller;
    return SafeArea(child:Padding(padding:const EdgeInsets.all(16),child:
      SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,
        crossAxisAlignment:CrossAxisAlignment.start,children:[
        Text('Ask Assistant about selected messages',style:Theme.of(context).textTheme.titleLarge),
        const SizedBox(height:8),
        Text('${c.messageIds.length} selected message(s). Only these messages will be shared privately with your Assistant.'),
        if (c.phase==HumanAiAssistPhase.choose) ...[
          DropdownButton<HumanAiAssistPurpose>(
            value:purpose,isExpanded:true,
            items:const [
              DropdownMenuItem(value:HumanAiAssistPurpose.reply,child:Text('Help me reply')),
              DropdownMenuItem(value:HumanAiAssistPurpose.translate,child:Text('Translate')),
              DropdownMenuItem(value:HumanAiAssistPurpose.prepareTalk,child:Text('Prepare a Talk')),
            ],onChanged:(next)=>setState((){if(next!=null)purpose=next;}),
          ),
          CheckboxListTile(contentPadding:EdgeInsets.zero,title:const Text('Mask phone and account numbers'),
            value:maskPrivateNumbers,onChanged:(value)=>setState(()=>maskPrivateNumbers=value??true)),
          CheckboxListTile(contentPadding:EdgeInsets.zero,
            title:const Text('I consent to process only my selected messages with AI'),
            subtitle:const Text('No other chat messages are shared or saved as Assistant memory.'),
            value:disclosed,onChanged:(value)=>setState(()=>disclosed=value??false)),
          FilledButton(onPressed:disclosed ? ()=>c.prepare(
            purpose:purpose,language:widget.language,
            disclosureAccepted:disclosed,maskPrivateNumbers:maskPrivateNumbers) : null,
            child:const Text('Prepare private preview')),
        ],
        if (c.phase==HumanAiAssistPhase.preparing ||
            c.phase==HumanAiAssistPhase.sending)
          const LinearProgressIndicator(),
        if (c.phase==HumanAiAssistPhase.review ||
            c.phase==HumanAiAssistPhase.uncertain) ...[
          const SizedBox(height:8),
          Text(c.preview?.purpose==HumanAiAssistPurpose.translate
              ? 'Translation (copy or discard)' : 'Assistant suggestion — review carefully'),
          TextField(controller:draft,maxLines:6,minLines:3,
            readOnly:c.preview?.purpose != HumanAiAssistPurpose.reply ||
                c.phase==HumanAiAssistPhase.uncertain,
            decoration:const InputDecoration(border:OutlineInputBorder(),labelText:'Review suggestion'),
            onChanged:(value) {
              // A changed draft needs a FRESH confirmation of its exact text.
              if (reviewedRecipient) setState(() => reviewedRecipient=false);
              c.changeReviewedText(value);
            }),
          if (c.preview?.purpose==HumanAiAssistPurpose.reply) ...[
            Text('Recipient: ${widget.recipientLabel}'),
            CheckboxListTile(contentPadding:EdgeInsets.zero,
              title:const Text('I verified the recipient and exact text'),
              value:reviewedRecipient,
              onChanged:(value)=>setState(()=>reviewedRecipient=value??false)),
            if (c.phase==HumanAiAssistPhase.review)
              FilledButton(onPressed:c.canSend && reviewedRecipient
                ? ()=>c.send(recipientAndTextConfirmed:reviewedRecipient) : null,
                child:const Text('Send reviewed reply')),
            if (c.phase==HumanAiAssistPhase.uncertain)
              OutlinedButton(onPressed:reviewedRecipient
                ? ()=>c.retryUncertain(recipientAndTextConfirmed:true) : null,
                child:const Text('Retry same send ID')),
          ],
          TextButton(onPressed:()=>c.discard(),child:const Text('Discard and clear')),
        ],
        if (c.phase==HumanAiAssistPhase.sent)
          const Text('Server accepted the message. Confirm delivery in the conversation.'),
        if (c.error!=null) Text(c.error!,style:TextStyle(color:Theme.of(context).colorScheme.error)),
      ]))));
  }
}
