import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/network/api_client.dart';
import 'package:luvin/features/couple/data/couple_api.dart';
import 'package:uuid/uuid.dart';

class ChatMessage {
  const ChatMessage({
    required this.messageId,
    required this.senderUserId,
    required this.body,
    required this.serverSequence,
  });

  final String messageId;
  final String? senderUserId;
  final String body;
  final String serverSequence;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      messageId: json['messageId'] as String,
      senderUserId: json['senderUserId'] as String?,
      body: json['body'] as String,
      serverSequence: json['serverSequence'] as String,
    );
  }
}

abstract class ChatRepository {
  Future<String?> conversationId(String connectionId);
  Future<List<ChatMessage>> messages(String conversationId);
  Future<ChatMessage> send(String conversationId, String body);
}

class ChatApi implements ChatRepository {
  ChatApi(this._client, {Uuid? uuid}) : _uuid = uuid ?? const Uuid();

  final ApiClient _client;
  final Uuid _uuid;

  @override
  Future<String?> conversationId(String connectionId) async {
    final data = await _client.requestJson(
      method: 'GET',
      path: '/connections/$connectionId/conversation',
      authenticated: true,
    );
    return data?['conversationId'] as String?;
  }

  @override
  Future<List<ChatMessage>> messages(String conversationId) async {
    final data = await _client.requestJson(
      method: 'GET',
      path: '/conversations/$conversationId/messages',
      authenticated: true,
    );
    final rows = data?['messages'] as List<dynamic>? ?? const [];
    return rows
        .map((item) => ChatMessage.fromJson(item as Map<String, dynamic>))
        .toList(growable: false);
  }

  @override
  Future<ChatMessage> send(String conversationId, String body) async {
    final data = await _client.requestJson(
      method: 'POST',
      path: '/conversations/$conversationId/messages',
      authenticated: true,
      body: {'clientMessageId': _uuid.v4(), 'body': body},
    );
    return ChatMessage.fromJson(data ?? const {});
  }
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  throw StateError('ChatRepository must be overridden in main.');
});

Future<CoupleSummary?> activeCouple(CoupleRepository couples) async {
  final rows = await couples.list();
  for (final row in rows) {
    if (row.state == 'ACTIVE') {
      return row;
    }
  }
  return null;
}
