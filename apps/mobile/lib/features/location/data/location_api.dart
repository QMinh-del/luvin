import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:luvin/core/network/api_client.dart';

class LocationFix {
  const LocationFix({
    required this.latitude,
    required this.longitude,
    required this.accuracyMeters,
  });

  final double latitude;
  final double longitude;
  final double accuracyMeters;
}

class PartnerLocation {
  const PartnerLocation({
    required this.userId,
    required this.latitude,
    required this.longitude,
    required this.capturedAt,
  });

  final String userId;
  final double latitude;
  final double longitude;
  final String capturedAt;

  factory PartnerLocation.fromJson(Map<String, dynamic> json) {
    return PartnerLocation(
      userId: json['userId'] as String,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      capturedAt: json['capturedAt'] as String,
    );
  }
}

class LocationSettings {
  const LocationSettings({required this.mode, required this.viewerUserIds});

  final String mode;
  final List<String> viewerUserIds;

  factory LocationSettings.fromJson(Map<String, dynamic> json) {
    return LocationSettings(
      mode: json['mode'] as String,
      viewerUserIds: (json['viewerUserIds'] as List<dynamic>)
          .map((item) => item as String)
          .toList(growable: false),
    );
  }
}

abstract class LocationRepository {
  Future<LocationSettings> settings();
  Future<void> setSharing({
    required String connectionId,
    required String viewerUserId,
    required bool enabled,
  });
  Future<void> setMode(String mode);
  Future<void> publish({
    required String connectionId,
    required LocationFix fix,
    required int sequence,
  });
  Future<PartnerLocation?> latest(String connectionId);
}

class LocationApi implements LocationRepository {
  LocationApi(this._client);

  final ApiClient _client;

  @override
  Future<LocationSettings> settings() async {
    final data = await _client.requestJson(
      method: 'GET',
      path: '/me/location-settings',
      authenticated: true,
    );
    return LocationSettings.fromJson(data ?? const {});
  }

  @override
  Future<void> setSharing({
    required String connectionId,
    required String viewerUserId,
    required bool enabled,
  }) async {
    await _client.requestJson(
      method: 'PATCH',
      path: '/me/location-settings',
      authenticated: true,
      body: {'mode': enabled ? 'LIVE' : 'PAUSED'},
    );
    await _client.requestJson(
      method: enabled ? 'PUT' : 'DELETE',
      path: '/connections/$connectionId/location-viewers/$viewerUserId',
      authenticated: true,
    );
  }

  @override
  Future<void> setMode(String mode) async {
    await _client.requestJson(
      method: 'PATCH',
      path: '/me/location-settings',
      authenticated: true,
      body: {'mode': mode},
    );
  }

  @override
  Future<void> publish({
    required String connectionId,
    required LocationFix fix,
    required int sequence,
  }) async {
    await _client.requestJson(
      method: 'POST',
      path: '/connections/$connectionId/locations',
      authenticated: true,
      body: {
        'capturedAt': DateTime.now().toUtc().toIso8601String(),
        'latitude': fix.latitude,
        'longitude': fix.longitude,
        'accuracyMeters': fix.accuracyMeters,
        'sequence': sequence,
        'source': 'FOREGROUND',
      },
    );
  }

  @override
  Future<PartnerLocation?> latest(String connectionId) async {
    final data = await _client.requestJson(
      method: 'GET',
      path: '/connections/$connectionId/locations/latest',
      authenticated: true,
    );
    final partner = data?['partner'];
    if (partner is! Map<String, dynamic>) {
      return null;
    }
    return PartnerLocation.fromJson(partner);
  }
}

final locationRepositoryProvider = Provider<LocationRepository>((ref) {
  throw StateError('LocationRepository must be overridden in main.');
});

Future<LocationFix?> readDeviceLocation() async {
  final enabled = await Geolocator.isLocationServiceEnabled();
  if (!enabled) {
    return null;
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    return null;
  }
  final position = await Geolocator.getCurrentPosition();
  return LocationFix(
    latitude: position.latitude,
    longitude: position.longitude,
    accuracyMeters: position.accuracy,
  );
}
