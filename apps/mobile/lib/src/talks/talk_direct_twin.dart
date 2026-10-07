class DirectTwinSeat {
  const DirectTwinSeat({required this.seatId, required this.personaId});
  final String seatId;
  final String personaId;
  factory DirectTwinSeat.fromJson(Map<String,dynamic> json) {
    final seatId=json['seatId'], personaId=json['personaId'];
    if(seatId is! String || personaId is! String) throw const FormatException('Invalid Direct Twin seat');
    return DirectTwinSeat(seatId: seatId, personaId: personaId);
  }
}

class DirectTwinInstruction {
  const DirectTwinInstruction({required this.revision, required this.instruction, this.expiresAt});
  final int revision;
  final String? instruction;
  final DateTime? expiresAt;
  factory DirectTwinInstruction.fromJson(Map<String,dynamic> json) {
    final revision=json['revision'];
    if(revision is! num) throw const FormatException('Invalid Direct Twin instruction');
    return DirectTwinInstruction(
      revision: revision.toInt(),
      instruction: json['instruction'] as String?,
      expiresAt: json['expiresAt'] is String ? DateTime.tryParse(json['expiresAt'] as String)?.toLocal() : null,
    );
  }
}

abstract interface class DirectTwinTransport {
  Future<List<DirectTwinSeat>> mine(String talkId);
  Future<DirectTwinInstruction> load({required String talkId, required String seatId});
  Future<DirectTwinInstruction> set({required String talkId, required String seatId, required int revision, required String instruction});
  Future<DirectTwinInstruction> clear({required String talkId, required String seatId, required int revision});
}
