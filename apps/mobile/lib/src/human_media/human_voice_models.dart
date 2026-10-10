class HumanVoiceNote {
  const HumanVoiceNote({
    required this.messageId, required this.conversationId,
    required this.sequence, required this.senderUserId, required this.clientRequestId,
    required this.durationMs, required this.sizeBytes, required this.createdAt,
  });
  final String messageId, conversationId, sequence, senderUserId, clientRequestId;
  final int durationMs, sizeBytes;
  final DateTime createdAt;

  factory HumanVoiceNote.fromJson(dynamic raw) {
    if (raw is! Map) throw const FormatException('Invalid voice receipt');
    final data = Map<String, dynamic>.from(raw);
    String requiredText(String key) {
      final value=data[key];
      if(value is! String || value.isEmpty)throw FormatException('Invalid voice $key');
      return value;
    }
    int requiredInt(String key,int minimum,int maximum){
      final value=data[key];
      if(value is! int||value<minimum||value>maximum)
        throw FormatException('Invalid voice $key');
      return value;
    }
    if(data['mimeType']!='audio/ogg'||data['deletedAt']!=null)
      throw const FormatException('Unavailable voice message');
    final date=DateTime.tryParse(requiredText('createdAt'));
    if(date==null)throw const FormatException('Invalid voice date');
    final sequence=requiredText('sequence');
    if(!RegExp(r'^[1-9][0-9]*$').hasMatch(sequence))
      throw const FormatException('Invalid voice sequence');
    return HumanVoiceNote(
      messageId:requiredText('messageId'),
      conversationId:requiredText('conversationId'),
      sequence:sequence,
      senderUserId:requiredText('senderUserId'),
      clientRequestId:requiredText('clientRequestId'),
      durationMs:requiredInt('durationMs',250,90000),
      sizeBytes:requiredInt('sizeBytes',84,1536*1024),
      createdAt:date,
    );
  }
}
