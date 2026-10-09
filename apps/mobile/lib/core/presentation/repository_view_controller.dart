import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/presentation/presentation_state.dart';

abstract interface class FeatureRepository<T> {
  Future<T?> load();
}

class RepositoryFailure implements Exception {
  const RepositoryFailure(this.code);

  final String code;
}

class MemoryFeatureRepository<T> implements FeatureRepository<T> {
  MemoryFeatureRepository({this.value, this.failureCode});

  T? value;
  String? failureCode;

  @override
  Future<T?> load() async {
    final code = failureCode;
    if (code != null) {
      throw RepositoryFailure(code);
    }
    return value;
  }
}

abstract class RepositoryViewController<T>
    extends AutoDisposeNotifier<PresentationState<T>> {
  FeatureRepository<T> get repository;

  @override
  PresentationState<T> build() => const PresentationState.loading();

  Future<void> load() async {
    final previous = state.data;
    state = PresentationState.loading(previousData: previous);
    try {
      final value = await repository.load();
      state = value == null
          ? const PresentationState.empty()
          : PresentationState.ready(value);
    } on RepositoryFailure catch (failure) {
      state = PresentationState.error(failure.code, previousData: previous);
    } catch (_) {
      state = PresentationState.error(
        'UNEXPECTED_ERROR',
        previousData: previous,
      );
    }
  }

  void setOffline() {
    state = PresentationState.offline(previousData: state.data);
  }

  void markStale() {
    state = state.asStale();
  }

  void denyPermission({bool permanent = false}) {
    state = PresentationState.permissionDenied(permanent: permanent);
  }

  void revokeAccess() {
    state = const PresentationState.revoked();
  }
}
