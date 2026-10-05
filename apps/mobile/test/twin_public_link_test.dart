import 'package:flutter_test/flutter_test.dart';
import 'package:masanawa/src/agents/twin_public_link.dart';

void main() {
  test('parses a simple Masanawa-style public twin path', () {
    final link = TwinPublicLink.parse(
      Uri.parse('https://masanawa.com/abdullahi'),
    );

    expect(link?.publicId, 'abdullahi');
  });

  test('rejects non-HTTPS or nested paths', () {
    expect(
      TwinPublicLink.parse(Uri.parse('http://masanawa.com/abdullahi')),
      isNull,
    );
    expect(
      TwinPublicLink.parse(Uri.parse('https://masanawa.com/twin/abdullahi')),
      isNull,
    );
  });
}
