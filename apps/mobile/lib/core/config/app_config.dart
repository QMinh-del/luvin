enum AppEnvironment { development, staging, production }

class AppConfig {
  const AppConfig({
    required this.apiBaseUrl,
    required this.wsBaseUrl,
    this.environment = AppEnvironment.development,
    this.expectedFirebaseProjectId = 'luvin-a9518',
  });

  factory AppConfig.fromEnvironment() {
    const raw = String.fromEnvironment(
      'LUVIN_API_BASE_URL',
      defaultValue: 'http://10.0.2.2:3000/v1',
    );
    const environmentName = String.fromEnvironment(
      'LUVIN_ENV',
      defaultValue: 'development',
    );
    const expectedFirebaseProjectId = String.fromEnvironment(
      'LUVIN_FIREBASE_PROJECT_ID',
      defaultValue: 'luvin-a9518',
    );
    final environment = AppEnvironment.values.firstWhere(
      (item) => item.name == environmentName,
      orElse: () => throw StateError('Unsupported LUVIN_ENV'),
    );
    return AppConfig.fromBaseUrl(
      raw,
      environment: environment,
      expectedFirebaseProjectId: expectedFirebaseProjectId,
    );
  }

  factory AppConfig.fromBaseUrl(
    String apiBaseUrl, {
    AppEnvironment environment = AppEnvironment.development,
    String expectedFirebaseProjectId = 'luvin-a9518',
  }) {
    final normalized = apiBaseUrl.endsWith('/')
        ? apiBaseUrl.substring(0, apiBaseUrl.length - 1)
        : apiBaseUrl;
    final ws = normalized
        .replaceFirst('https://', 'wss://')
        .replaceFirst('http://', 'ws://');
    return AppConfig(
      apiBaseUrl: normalized,
      wsBaseUrl: '$ws/realtime',
      environment: environment,
      expectedFirebaseProjectId: expectedFirebaseProjectId,
    );
  }

  final String apiBaseUrl;
  final String wsBaseUrl;
  final AppEnvironment environment;
  final String expectedFirebaseProjectId;

  void validateFirebaseProject(String actualProjectId) {
    if (actualProjectId != expectedFirebaseProjectId) {
      throw StateError('Firebase project does not match LUVIN_ENV');
    }
    if (environment != AppEnvironment.development &&
        actualProjectId == 'luvin-a9518') {
      throw StateError(
        'Development Firebase cannot be used outside development',
      );
    }
  }
}
