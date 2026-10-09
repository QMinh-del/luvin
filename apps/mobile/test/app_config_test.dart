import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/config/app_config.dart';

void main() {
  test('accepts the configured Firebase project', () {
    final config = AppConfig.fromBaseUrl('http://example.test/v1');

    expect(
      () => config.validateFirebaseProject('luvin-a9518'),
      returnsNormally,
    );
  });

  test('rejects a Firebase project mismatch', () {
    final config = AppConfig.fromBaseUrl('http://example.test/v1');

    expect(
      () => config.validateFirebaseProject('another-project'),
      throwsStateError,
    );
  });

  test('rejects the development Firebase project in production', () {
    final config = AppConfig.fromBaseUrl(
      'https://api.example.test/v1',
      environment: AppEnvironment.production,
      expectedFirebaseProjectId: 'luvin-a9518',
    );

    expect(
      () => config.validateFirebaseProject('luvin-a9518'),
      throwsStateError,
    );
  });
}
