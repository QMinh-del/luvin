import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/contracts/api_envelope.dart';

void main() {
  test('parses the standard API error envelope', () {
    final envelope = ApiErrorEnvelope.fromJson({
      'error': {
        'code': 'INTERNAL_ERROR',
        'message': 'An unexpected error occurred',
        'fields': <String, String>{},
        'requestId': 'req-1',
      },
    });
    expect(envelope.code, 'INTERNAL_ERROR');
    expect(envelope.requestId, 'req-1');
    expect(envelope.message.contains('token'), isFalse);
  });
}
