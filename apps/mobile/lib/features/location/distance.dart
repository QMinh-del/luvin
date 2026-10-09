import 'dart:math' as math;

double distanceMeters(
  double latitudeA,
  double longitudeA,
  double latitudeB,
  double longitudeB,
) {
  const earthMeters = 6371000.0;
  final latA = latitudeA * math.pi / 180;
  final latB = latitudeB * math.pi / 180;
  final dLat = (latitudeB - latitudeA) * math.pi / 180;
  final dLon = (longitudeB - longitudeA) * math.pi / 180;
  final haversine =
      math.pow(math.sin(dLat / 2), 2) +
      math.cos(latA) * math.cos(latB) * math.pow(math.sin(dLon / 2), 2);
  return earthMeters *
      2 *
      math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine));
}

String formatDistance(double meters) {
  if (meters < 1000) {
    return '${meters.round()} m';
  }
  return '${(meters / 1000).toStringAsFixed(1)} km';
}
