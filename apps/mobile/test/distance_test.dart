import 'package:flutter_test/flutter_test.dart';
import 'package:luvin/features/location/distance.dart';

void main() {
  test('distance between the two demo points is a few kilometers', () {
    final meters = distanceMeters(10.7769, 106.7009, 10.7626, 106.6822);
    expect(meters, greaterThan(2000));
    expect(meters, lessThan(4000));
    expect(formatDistance(meters), endsWith(' km'));
  });
}
