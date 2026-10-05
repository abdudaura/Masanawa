import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/safety/twin_safety.dart';

void main() {
  test('report reasons use stable wire values', () {
    expect(
      twinReportReasonWire(TwinReportReason.impersonation),
      'impersonation',
    );
    expect(
      twinReportReasonWire(TwinReportReason.sexualContent),
      'sexual-content',
    );
    expect(
      twinReportReasonWire(TwinReportReason.selfHarm),
      'self-harm',
    );
  });

  test('report labels remain human readable', () {
    expect(
      twinReportReasonLabel(TwinReportReason.fraud),
      'Fraud or scam',
    );
  });
}
