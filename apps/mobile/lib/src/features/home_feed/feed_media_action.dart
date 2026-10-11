import 'package:flutter/material.dart';
import 'feed_api.dart';

/// C23 feature-local action. AF00/C22 owner mounts it on C21 or C22,
/// retaining the source post id so the server can authorize this exact media.
class FeedMediaOpenAction extends StatelessWidget {
  const FeedMediaOpenAction({super.key,required this.post,required this.mediaId,
    required this.onOpen});
  final FeedPost post;
  final String mediaId;
  final void Function(FeedPost post,String mediaId) onOpen;
  @override Widget build(BuildContext context) {
    final ha=Localizations.localeOf(context).languageCode=='ha';
    return ActionChip(
      avatar:Icon(post.kind=='audio'?Icons.play_circle_outline:Icons.image_outlined),
      label:Text(post.kind=='audio'?(ha?'Kunna sauti':'Play audio'):(ha?'Duba hoto':'View image')),
      onPressed:()=>onOpen(post,mediaId),
    );
  }
}
