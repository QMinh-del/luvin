import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:web_socket_channel/io.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:luvin/core/config/app_config.dart';
import 'package:luvin/core/session/auth_session.dart';

class RealtimeEvent {
  const RealtimeEvent({
    required this.event,
    this.connectionId,
    this.payload = const {},
  });

  final String event;
  final String? connectionId;
  final Map<String, dynamic> payload;
}

class AppWebSocket {
  AppWebSocket({required this.config, this.onConnect});

  final AppConfig config;
  final void Function(AuthSession session)? onConnect;

  final _events = StreamController<RealtimeEvent>.broadcast();
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _messages;
  Timer? _heartbeat;
  Timer? _retry;
  AuthSession? _session;
  String? _accessToken;
  var _attempt = 0;
  var _closedByUser = false;

  Stream<RealtimeEvent> get events => _events.stream;
  bool get isConnected => _channel != null;
  String? get accessToken => _accessToken;

  Future<void> connect(AuthSession session) async {
    _closedByUser = false;
    _session = session;
    _attempt = 0;
    _retry?.cancel();
    await _open(session);
  }

  Future<void> _open(AuthSession session) async {
    await _stopSocket();
    _accessToken = session.accessToken;
    if (onConnect != null) {
      onConnect!(session);
      return;
    }
    final channel = IOWebSocketChannel.connect(
      Uri.parse(config.wsBaseUrl),
      headers: {'authorization': 'Bearer ${session.accessToken}'},
    );
    try {
      await channel.ready.timeout(const Duration(seconds: 8));
      _channel = channel;
      _attempt = 0;
      _messages = channel.stream.listen(
        _onMessage,
        onError: (_) => _scheduleReconnect(),
        onDone: _scheduleReconnect,
      );
      _heartbeat?.cancel();
      _heartbeat = Timer.periodic(const Duration(seconds: 25), (_) {
        _sendHeartbeat();
      });
    } on Object {
      await channel.sink.close();
      _scheduleReconnect();
      throw WebSocketChannelException('realtime unavailable');
    }
  }

  void _sendHeartbeat() {
    final channel = _channel;
    if (channel == null) {
      return;
    }
    channel.sink.add(
      jsonEncode({
        'event': 'system.heartbeat.v1',
        'occurredAt': DateTime.now().toUtc().toIso8601String(),
        'payload': <String, dynamic>{},
      }),
    );
  }

  void _scheduleReconnect() {
    unawaited(_stopSocket());
    if (_closedByUser || _session == null || onConnect != null) {
      return;
    }
    _retry?.cancel();
    final seconds = min(30, 1 << min(_attempt, 5));
    _attempt += 1;
    _retry = Timer(Duration(seconds: seconds), () {
      final session = _session;
      if (session == null || _closedByUser) {
        return;
      }
      unawaited(
        _open(session).catchError((Object _) {}),
      );
    });
  }

  void _onMessage(dynamic raw) {
    if (raw is! String) {
      return;
    }
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      return;
    }
    final map = Map<String, dynamic>.from(decoded);
    final payload = map['payload'];
    _events.add(
      RealtimeEvent(
        event: map['event'] as String? ?? '',
        connectionId: map['connectionId'] as String?,
        payload: payload is Map
            ? Map<String, dynamic>.from(payload)
            : const {},
      ),
    );
  }

  Future<void> disconnect() async {
    _closedByUser = true;
    _session = null;
    _accessToken = null;
    _retry?.cancel();
    _heartbeat?.cancel();
    await _stopSocket();
  }

  Future<void> _stopSocket() async {
    _heartbeat?.cancel();
    _heartbeat = null;
    await _messages?.cancel();
    _messages = null;
    await _channel?.sink.close();
    _channel = null;
  }
}
