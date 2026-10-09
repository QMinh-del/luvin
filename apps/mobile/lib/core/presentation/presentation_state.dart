import 'package:flutter/foundation.dart';

enum PresentationStatus {
  loading,
  empty,
  ready,
  offline,
  error,
  permissionDenied,
  revoked,
}

enum ViewConnectivity { connecting, online, offline }

enum ViewPermission { unknown, granted, denied, permanentlyDenied, revoked }

@immutable
class PresentationState<T> {
  const PresentationState._({
    required this.status,
    required this.connectivity,
    required this.permission,
    required this.isStale,
    this.data,
    this.errorCode,
  });

  const PresentationState.loading({T? previousData})
    : this._(
        status: PresentationStatus.loading,
        connectivity: ViewConnectivity.connecting,
        permission: ViewPermission.unknown,
        isStale: false,
        data: previousData,
      );

  const PresentationState.empty()
    : this._(
        status: PresentationStatus.empty,
        connectivity: ViewConnectivity.online,
        permission: ViewPermission.granted,
        isStale: false,
      );

  const PresentationState.ready(T value, {bool stale = false})
    : this._(
        status: PresentationStatus.ready,
        connectivity: ViewConnectivity.online,
        permission: ViewPermission.granted,
        isStale: stale,
        data: value,
      );

  const PresentationState.offline({T? previousData})
    : this._(
        status: PresentationStatus.offline,
        connectivity: ViewConnectivity.offline,
        permission: ViewPermission.unknown,
        isStale: previousData != null,
        data: previousData,
      );

  const PresentationState.error(String code, {T? previousData})
    : this._(
        status: PresentationStatus.error,
        connectivity: ViewConnectivity.online,
        permission: ViewPermission.unknown,
        isStale: previousData != null,
        data: previousData,
        errorCode: code,
      );

  const PresentationState.permissionDenied({bool permanent = false})
    : this._(
        status: PresentationStatus.permissionDenied,
        connectivity: ViewConnectivity.online,
        permission: permanent
            ? ViewPermission.permanentlyDenied
            : ViewPermission.denied,
        isStale: false,
      );

  const PresentationState.revoked()
    : this._(
        status: PresentationStatus.revoked,
        connectivity: ViewConnectivity.online,
        permission: ViewPermission.revoked,
        isStale: false,
      );

  final PresentationStatus status;
  final ViewConnectivity connectivity;
  final ViewPermission permission;
  final bool isStale;
  final T? data;
  final String? errorCode;

  bool get hasProtectedData => data != null;

  PresentationState<T> asStale() {
    final value = data;
    return value == null
        ? PresentationState<T>.offline()
        : PresentationState<T>.ready(value, stale: true);
  }
}
