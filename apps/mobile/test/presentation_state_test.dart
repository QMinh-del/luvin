import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/core/presentation/presentation_state.dart';
import 'package:luvin/core/presentation/repository_view_controller.dart';

final repositoryProvider = Provider<FeatureRepository<String>>(
  (ref) => MemoryFeatureRepository<String>(),
);

class TestViewController extends RepositoryViewController<String> {
  @override
  FeatureRepository<String> get repository => ref.read(repositoryProvider);
}

final testViewProvider =
    AutoDisposeNotifierProvider<TestViewController, PresentationState<String>>(
      TestViewController.new,
    );

void main() {
  test(
    'repository controller covers data stale offline and revocation',
    () async {
      final repository = MemoryFeatureRepository<String>(value: 'private data');
      final container = ProviderContainer(
        overrides: [repositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      final subscription = container.listen(testViewProvider, (_, _) {});
      addTearDown(subscription.close);
      final controller = container.read(testViewProvider.notifier);

      await controller.load();
      expect(container.read(testViewProvider).data, 'private data');
      controller.markStale();
      expect(container.read(testViewProvider).isStale, isTrue);
      controller.setOffline();
      expect(
        container.read(testViewProvider).status,
        PresentationStatus.offline,
      );
      expect(container.read(testViewProvider).data, 'private data');
      controller.revokeAccess();
      expect(
        container.read(testViewProvider).status,
        PresentationStatus.revoked,
      );
      expect(container.read(testViewProvider).hasProtectedData, isFalse);
    },
  );

  test('repository failures expose only typed codes', () async {
    final repository = MemoryFeatureRepository<String>(
      failureCode: 'NETWORK_OFFLINE',
    );
    final container = ProviderContainer(
      overrides: [repositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(testViewProvider, (_, _) {});
    addTearDown(subscription.close);

    await container.read(testViewProvider.notifier).load();

    final state = container.read(testViewProvider);
    expect(state.status, PresentationStatus.error);
    expect(state.errorCode, 'NETWORK_OFFLINE');
    expect(state.data, isNull);
  });

  test('permission denial clears protected presentation data', () async {
    final repository = MemoryFeatureRepository<String>(value: 'private data');
    final container = ProviderContainer(
      overrides: [repositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(testViewProvider, (_, _) {});
    addTearDown(subscription.close);
    final controller = container.read(testViewProvider.notifier);
    await controller.load();

    controller.denyPermission(permanent: true);

    final state = container.read(testViewProvider);
    expect(state.status, PresentationStatus.permissionDenied);
    expect(state.permission, ViewPermission.permanentlyDenied);
    expect(state.hasProtectedData, isFalse);
  });

  test('feature widgets do not import transport storage or platform APIs', () {
    final featureRoot = Directory('lib/features');
    final widgetFiles = featureRoot
        .listSync(recursive: true)
        .whereType<File>()
        .where((file) => file.path.endsWith('_page.dart'));
    const forbidden = [
      'package:http/',
      'flutter_secure_storage',
      'core/network/',
      'core/realtime/',
      'MethodChannel',
      'EventChannel',
    ];

    for (final file in widgetFiles) {
      final source = file.readAsStringSync();
      for (final pattern in forbidden) {
        expect(
          source.contains(pattern),
          isFalse,
          reason: '${file.path} must not access $pattern directly',
        );
      }
    }
  });
}
