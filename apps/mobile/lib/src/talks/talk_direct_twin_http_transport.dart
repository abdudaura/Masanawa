import '../core/network/api_client.dart';
import 'talk_direct_twin.dart';

class GatewayDirectTwinTransport implements DirectTwinTransport {
  GatewayDirectTwinTransport({required this.api});
  final ApiClient api;
  String _base(String talkId) => '/talks/' + Uri.encodeComponent(talkId) + '/twin-seats';

  @override
  Future<List<DirectTwinSeat>> mine(String talkId) async {
    final response=await api.dio.get<dynamic>(_base(talkId)+'/mine');
    final data=response.data;
    if(data is! List) throw const FormatException('Invalid Direct Twin seats response');
    return [for(final item in data) if(item is Map) DirectTwinSeat.fromJson(item.cast<String,dynamic>())];
  }

  @override
  Future<DirectTwinInstruction> load({required String talkId, required String seatId}) async {
    final response=await api.dio.get<dynamic>(_base(talkId)+'/' + Uri.encodeComponent(seatId) + '/direct');
    return _instruction(response.data);
  }

  @override
  Future<DirectTwinInstruction> set({required String talkId, required String seatId, required int revision, required String instruction}) async {
    final response=await api.dio.put<dynamic>(
      _base(talkId)+'/' + Uri.encodeComponent(seatId) + '/direct',
      data: {'expectedRevision': revision == 0 ? null : revision, 'instruction': instruction},
    );
    return _instruction(response.data);
  }

  @override
  Future<DirectTwinInstruction> clear({required String talkId, required String seatId, required int revision}) async {
    final response=await api.dio.delete<dynamic>(
      _base(talkId)+'/' + Uri.encodeComponent(seatId) + '/direct',
      queryParameters: {'expectedRevision': revision},
    );
    return _instruction(response.data);
  }

  DirectTwinInstruction _instruction(dynamic data) {
    if(data is Map<String,dynamic>) return DirectTwinInstruction.fromJson(data);
    if(data is Map) return DirectTwinInstruction.fromJson(data.cast<String,dynamic>());
    throw const FormatException('Invalid Direct Twin response');
  }
}
