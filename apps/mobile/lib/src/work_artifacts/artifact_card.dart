import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'artifact_controller.dart';

/// Nested Assistant result part, not a new tab. Bind to canonical account changes before mounting.
class ArtifactCard extends StatelessWidget {
  const ArtifactCard({super.key,required this.controller,this.selectRecipient});
  final ArtifactController controller;
  /// Existing C01 accepted-person picker. Null means sharing isn't integrated and no Share control is shown.
  final Future<({String userId,String displayName})?> Function()? selectRecipient;
  Future<bool> _confirm(BuildContext context,String title,String body) async =>
    await showDialog<bool>(context:context,builder:(context)=>AlertDialog(title:Text(title),content:Text(body),actions:[
      TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),
      FilledButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Confirm'))])) ?? false;
  @override
  Widget build(BuildContext context)=>ListenableBuilder(listenable:controller,builder:(context,_) {
    final file=controller.artifact,enabled=!controller.busy,binding=controller.binding;
    if (!controller.bound) return const SizedBox.shrink();
    return Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Text(file?.filename ?? 'Work file',style:Theme.of(context).textTheme.titleMedium),
      if (file!=null) Text('${file.state} · ${file.sizeBytes} bytes · Text file'),
      if (controller.busy) LinearProgressIndicator(value:controller.progress,semanticsLabel:'Loading file'),
      if (controller.error!=null) Text(controller.error!,semanticsLabel:controller.error),
      Wrap(spacing:8,runSpacing:4,children:[
        TextButton(onPressed:enabled?controller.refresh:null,child:const Text('Refresh')),
        if(file?.ready==true) TextButton(onPressed:enabled?controller.previewFile:null,child:const Text('Preview')),
        if(file?.ready==true) TextButton(onPressed:enabled?() async {
          if (await _confirm(context,'Save a copy?','A saved copy remains on this device after access is revoked.') && controller.binding==binding) {
            await controller.exportFile((filename,bytes) async {
              await FilePicker.platform.saveFile(dialogTitle:'Save work file',fileName:filename,bytes:bytes,
                type:FileType.custom,allowedExtensions:['txt']);
            });
          }
        }:null,child:const Text('Save')),
        if(file?.owned==true && {'failed','generating'}.contains(file?.state))
          TextButton(onPressed:enabled?controller.recover:null,child:const Text('Check saved result')),
        if(file?.owned==true && file?.ready==true && selectRecipient!=null)
          TextButton(onPressed:enabled?() async {
            final sourceId=file!.id,sourceRevision=file.revision;
            final recipient=await selectRecipient!();
            if (recipient==null || !context.mounted || controller.binding!=binding || controller.artifact?.id!=sourceId || controller.artifact?.revision!=sourceRevision) return;
            if(await _confirm(context,'Share file?','Allow ${recipient.displayName} to read this file for one hour?')) {
              if(controller.binding==binding && controller.artifact?.id==sourceId && controller.artifact?.revision==sourceRevision) await controller.share(recipient.userId);
            }
          }:null,child:const Text('Share')),
        if(file?.owned==true && file?.ready==true)
          TextButton(onPressed:enabled?() async {
            if(await _confirm(context,'Revoke access?','Future downloads will be blocked. Previously saved copies cannot be erased.') && controller.binding==binding) await controller.revoke();
          }:null,child:const Text('Revoke')),
        if(file?.owned==true && file?.state!='deleted')
          TextButton(onPressed:enabled?() async {
            if(await _confirm(context,'Delete file?','Remove the stored file and block future access?') && controller.binding==binding) await controller.remove();
          }:null,child:const Text('Delete')),
      ]),
      if(controller.preview!=null) ConstrainedBox(constraints:const BoxConstraints(maxHeight:320),
        child:SingleChildScrollView(child:SelectableText(controller.preview!))),
    ])));
  });
}
