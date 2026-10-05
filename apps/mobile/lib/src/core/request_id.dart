import 'dart:math';

final Random _secure = Random.secure();

String createRequestId({DateTime? now}) {
  final millis = (now ?? DateTime.now()).toUtc().millisecondsSinceEpoch;
  if (millis < 0 || millis > 0xffffffffffff) {
    throw RangeError('Timestamp cannot be represented as UUIDv7');
  }
  final bytes = List<int>.generate(16, (_) => _secure.nextInt(256));
  bytes[0] = (millis >> 40) & 0xff;
  bytes[1] = (millis >> 32) & 0xff;
  bytes[2] = (millis >> 24) & 0xff;
  bytes[3] = (millis >> 16) & 0xff;
  bytes[4] = (millis >> 8) & 0xff;
  bytes[5] = millis & 0xff;
  bytes[6] = 0x70 | (bytes[6] & 0x0f);
  bytes[8] = 0x80 | (bytes[8] & 0x3f);
  String hex(int value) => value.toRadixString(16).padLeft(2, '0');
  final raw = bytes.map(hex).join();
  final uuid =
      '${raw.substring(0, 8)}-${raw.substring(8, 12)}-'
      '${raw.substring(12, 16)}-${raw.substring(16, 20)}-'
      '${raw.substring(20)}';
  return 'request_$uuid';
}
