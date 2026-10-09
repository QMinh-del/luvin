import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/features/chat/data/chat_api.dart';
import 'package:luvin/features/couple/data/couple_api.dart';
import 'package:luvin/features/location/data/location_api.dart';
import 'package:luvin/features/location/distance.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/features/social/data/social_api.dart';
import 'package:luvin/l10n/app_localizations.dart';

class MapPage extends ConsumerStatefulWidget {
  const MapPage({super.key, this.readLocation = readDeviceLocation});

  final Future<LocationFix?> Function() readLocation;

  @override
  ConsumerState<MapPage> createState() => _MapPageState();
}

class _MapPageState extends ConsumerState<MapPage> {
  CoupleSummary? _couple;
  PartnerLocation? _partner;
  LocationFix? _self;
  bool _sharing = false;
  String? _partnerMood;
  String? _presence;
  bool _pingOn = false;
  bool _loading = true;
  String? _error;
  int _sequence = DateTime.now().millisecondsSinceEpoch;
  Timer? _poll;
  StreamSubscription<RealtimeEvent>? _events;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_reload);
    _events = ref.read(realtimeEventsProvider).listen((event) {
      if (event.event == 'location.mode.changed.v1') {
        final mode = event.payload['mode'] as String?;
        if (!mounted || mode == null) {
          return;
        }
        setState(() {
          if (mode != 'LIVE') {
            _partner = null;
          }
        });
        return;
      }
      if (event.event == 'presence.changed.v1') {
        final state = event.payload['state'] as String?;
        if (mounted && state != null) {
          setState(() => _presence = state);
        }
        return;
      }
      if (event.event == 'love_ping.received.v1') {
        if (!mounted) {
          return;
        }
        setState(() => _pingOn = true);
        Future<void>.delayed(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() => _pingOn = false);
          }
        });
        return;
      }
      if (event.event == 'mood.changed.v1' ||
          event.event == 'mood.cleared.v1') {
        unawaited(_loadMood());
        return;
      }
      if (event.event != 'location.partner.updated.v1') {
        return;
      }
      final coordinate = event.payload['coordinate'];
      if (coordinate is! Map) {
        return;
      }
      final latitude = coordinate['latitude'];
      final longitude = coordinate['longitude'];
      final capturedAt = event.payload['capturedAt'];
      if (latitude is! num || longitude is! num || capturedAt is! String) {
        return;
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _partner = PartnerLocation(
          userId: event.payload['subjectUserId'] as String? ?? '',
          latitude: latitude.toDouble(),
          longitude: longitude.toDouble(),
          capturedAt: capturedAt,
        );
      });
    });
    _poll = Timer.periodic(const Duration(seconds: 45), (_) {
      unawaited(_tick());
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    unawaited(_events?.cancel());
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _loadCouple();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code);
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _loadCouple() async {
    final userId = ref.read(sessionProvider).session?.userId;
    final couple = await activeCouple(ref.read(coupleRepositoryProvider));
    if (couple == null || userId == null) {
      _couple = null;
      _partner = null;
      _self = null;
      _sharing = false;
      return;
    }
    final partner = _otherPartner(couple, userId);
    _couple = couple;
    _self = await widget.readLocation();
    if (partner != null && _self != null) {
      await ref
          .read(locationRepositoryProvider)
          .setSharing(
            connectionId: couple.connectionId,
            viewerUserId: partner.userId,
            enabled: true,
          );
      _sharing = true;
    } else {
      _sharing = false;
      if (partner != null) {
        _error = 'LOCATION_PERMISSION';
      }
    }
    _partner = await ref
        .read(locationRepositoryProvider)
        .latest(couple.connectionId);
    await _loadMood();
  }

  Future<void> _loadMood() async {
    final couple = _couple;
    final userId = ref.read(sessionProvider).session?.userId;
    final partner = _otherPartner(couple, userId);
    if (couple == null || partner == null) {
      return;
    }
    try {
      final moods = await ref
          .read(socialRepositoryProvider)
          .moods(couple.connectionId);
      String? mood;
      for (final item in moods) {
        if (item.userId == partner.userId) {
          mood = item.moodCode;
        }
      }
      if (mounted) {
        setState(() => _partnerMood = mood);
      }
    } on ApiException {
      return;
    }
  }

  Future<void> _tick() async {
    final couple = _couple;
    if (couple == null) {
      return;
    }
    try {
      if (_sharing) {
        final fix = await widget.readLocation();
        if (fix != null) {
          _self = fix;
          _sequence += 1;
          await ref
              .read(locationRepositoryProvider)
              .publish(
                connectionId: couple.connectionId,
                fix: fix,
                sequence: _sequence,
              );
        }
      }
      final partner = await ref
          .read(locationRepositoryProvider)
          .latest(couple.connectionId);
      if (!mounted) {
        return;
      }
      setState(() => _partner = partner);
    } on ApiException catch (error) {
      if (error.code == 'LOCATION_REPLAY') {
        _sequence = DateTime.now().millisecondsSinceEpoch;
        return;
      }
      if (mounted) {
        setState(() => _error = error.code);
      }
    }
  }

  Future<void> _pingPartner() async {
    final couple = _couple;
    final userId = ref.read(sessionProvider).session?.userId;
    final partner = _otherPartner(couple, userId);
    if (couple == null || partner == null) {
      return;
    }
    try {
      await ref
          .read(socialRepositoryProvider)
          .lovePing(
            connectionId: couple.connectionId,
            targetUserId: partner.userId,
          );
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code);
      }
    }
  }

  String _moodLabel(AppLocalizations l10n, String? code) {
    return switch (code) {
      'HAPPY' => l10n.moodHappy,
      'LOVING' => l10n.moodLoving,
      'MISSING' => l10n.moodMissing,
      'CALM' => l10n.moodCalm,
      'BUSY' => l10n.moodBusy,
      'SLEEPY' => l10n.moodSleepy,
      _ => l10n.moodLabel,
    };
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final userId = ref.watch(sessionProvider).session?.userId;
    final partnerName = _otherPartner(_couple, userId)?.displayName;
    final distance = _self != null && _partner != null
        ? formatDistance(
            distanceMeters(
              _self!.latitude,
              _self!.longitude,
              _partner!.latitude,
              _partner!.longitude,
            ),
          )
        : null;
    final presence = _presence == 'ONLINE'
        ? l10n.presenceOnline
        : _presence == 'OFFLINE'
        ? l10n.presenceOffline
        : null;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navMap)),
      body: Stack(
        children: [
          _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_error != null)
                      Text(
                        _error == 'LOCATION_PERMISSION'
                            ? l10n.statePermissionDenied
                            : _error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    if (_couple == null)
                      Text(l10n.locationNoCouple)
                    else ...[
                      SizedBox(height: 360, child: _demoMap(partnerName)),
                      const SizedBox(height: 12),
                      if (partnerName != null)
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  partnerName,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  [
                                    if (presence != null) presence,
                                    _moodLabel(l10n, _partnerMood),
                                  ].join(' · '),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  distance == null
                                      ? l10n.locationHidden
                                      : l10n.locationDistance(distance),
                                ),
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 8,
                                  children: [
                                    FilledButton(
                                      onPressed: () => context.go('/chat'),
                                      child: Text(l10n.partnerOpenChat),
                                    ),
                                    OutlinedButton(
                                      onPressed: _pingPartner,
                                      child: Text(l10n.lovePing),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ],
                ),
          if (_pingOn)
            const IgnorePointer(
              child: Center(
                child: Icon(
                  Icons.favorite,
                  size: 128,
                  color: Color(0xFF7A1F3D),
                ),
              ),
            ),
        ],
      ),
    );
  }

  CouplePartner? _otherPartner(CoupleSummary? couple, String? userId) {
    if (couple == null) {
      return null;
    }
    for (final partner in couple.partners) {
      if (partner.userId != userId) {
        return partner;
      }
    }
    return null;
  }

  Widget _demoMap(String? partnerName) {
    const fallback = LatLng(10.7769, 106.7009);
    final self = _self == null
        ? null
        : LatLng(_self!.latitude, _self!.longitude);
    final partner = _partner == null
        ? null
        : LatLng(_partner!.latitude, _partner!.longitude);
    final center = self ?? partner ?? fallback;
    return FlutterMap(
      options: MapOptions(initialCenter: center, initialZoom: 13),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.luvin.app',
        ),
        MarkerLayer(
          markers: [
            if (self != null)
              Marker(
                point: self,
                width: 80,
                height: 48,
                child: const _Pin(label: 'You', color: Color(0xFF7A1F3D)),
              ),
            if (partner != null)
              Marker(
                point: partner,
                width: 96,
                height: 48,
                child: _Pin(
                  label: partnerName ?? 'Partner',
                  color: const Color(0xFF2F5D50),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _Pin extends StatelessWidget {
  const _Pin({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.location_on, color: color, size: 28),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: color,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
