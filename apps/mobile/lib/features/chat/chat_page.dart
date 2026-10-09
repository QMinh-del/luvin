import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:luvin/core/session/auth_session.dart';
import 'package:luvin/features/chat/data/chat_api.dart';
import 'package:luvin/features/couple/data/couple_api.dart';
import 'package:luvin/features/session/session_controller.dart';
import 'package:luvin/features/social/data/social_api.dart';
import 'package:luvin/l10n/app_localizations.dart';

class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({super.key});

  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  List<ChatMessage> _messages = const [];
  List<MoodView> _moods = const [];
  String? _conversationId;
  String? _connectionId;
  String? _partnerUserId;
  String? _partnerName;
  String? _presence;
  String? _ping;
  String? _error;
  bool _loading = true;
  bool _sending = false;
  Timer? _poll;
  StreamSubscription<RealtimeEvent>? _events;

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_reload);
    _events = ref.read(realtimeEventsProvider).listen((event) {
      if (event.event == 'chat.message.created.v1' ||
          event.event == 'mood.changed.v1' ||
          event.event == 'mood.cleared.v1') {
        unawaited(_refreshQuiet());
      } else if (event.event == 'presence.changed.v1') {
        final state = event.payload['state'] as String?;
        if (mounted && state != null) {
          setState(() => _presence = state);
        }
      } else if (event.event == 'love_ping.received.v1' && mounted) {
        setState(() => _ping = 'received');
      }
    });
    _poll = Timer.periodic(const Duration(seconds: 45), (_) {
      unawaited(_refreshQuiet());
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    unawaited(_events?.cancel());
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _load();
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

  Future<void> _refreshQuiet() async {
    if (_sending || _conversationId == null) {
      return;
    }
    try {
      final messages = await ref
          .read(chatRepositoryProvider)
          .messages(_conversationId!);
      final moods = _connectionId == null
          ? const <MoodView>[]
          : await ref.read(socialRepositoryProvider).moods(_connectionId!);
      if (!mounted || (_same(messages) && _sameMoods(moods))) {
        return;
      }
      setState(() {
        _messages = messages;
        _moods = moods;
      });
      _scrollToEnd();
    } on ApiException {
      return;
    }
  }

  Future<void> _load() async {
    final couple = await activeCouple(ref.read(coupleRepositoryProvider));
    if (couple == null) {
      _conversationId = null;
      _connectionId = null;
      _messages = const [];
      _moods = const [];
      return;
    }
    final userId = ref.read(sessionProvider).session?.userId;
    final partner = _other(couple, userId);
    final conversationId = await ref
        .read(chatRepositoryProvider)
        .conversationId(couple.connectionId);
    if (conversationId == null) {
      _conversationId = null;
      _connectionId = couple.connectionId;
      _messages = const [];
      return;
    }
    final messages = await ref
        .read(chatRepositoryProvider)
        .messages(conversationId);
    final moods = await ref
        .read(socialRepositoryProvider)
        .moods(couple.connectionId);
    _conversationId = conversationId;
    _connectionId = couple.connectionId;
    _partnerUserId = partner?.userId;
    _partnerName = partner?.displayName;
    _messages = messages;
    _moods = moods;
    _scrollToEnd();
  }

  bool _same(List<ChatMessage> next) {
    if (next.length != _messages.length) {
      return false;
    }
    for (var index = 0; index < next.length; index += 1) {
      if (next[index].messageId != _messages[index].messageId) {
        return false;
      }
    }
    return true;
  }

  Future<void> _send() async {
    final conversationId = _conversationId;
    final body = _text.text.trim();
    if (conversationId == null || body.isEmpty || _sending) {
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(chatRepositoryProvider).send(conversationId, body);
      _text.clear();
      final messages = await ref
          .read(chatRepositoryProvider)
          .messages(conversationId);
      if (mounted) {
        setState(() => _messages = messages);
      }
      _scrollToEnd();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code);
      }
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  bool _sameMoods(List<MoodView> next) {
    if (next.length != _moods.length) {
      return false;
    }
    for (var index = 0; index < next.length; index += 1) {
      if (next[index].userId != _moods[index].userId ||
          next[index].moodCode != _moods[index].moodCode) {
        return false;
      }
    }
    return true;
  }

  CouplePartner? _other(CoupleSummary couple, String? userId) {
    for (final partner in couple.partners) {
      if (partner.userId != userId) {
        return partner;
      }
    }
    return null;
  }

  Future<void> _setMood(String code) async {
    try {
      await ref.read(socialRepositoryProvider).setMood(code);
      await _refreshQuiet();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code);
      }
    }
  }

  Future<void> _sendPing() async {
    final connectionId = _connectionId;
    final partnerUserId = _partnerUserId;
    if (connectionId == null || partnerUserId == null) {
      return;
    }
    try {
      await ref
          .read(socialRepositoryProvider)
          .lovePing(connectionId: connectionId, targetUserId: partnerUserId);
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.code);
      }
    }
  }

  String _moodLabel(AppLocalizations l10n, String code) {
    return switch (code) {
      'HAPPY' => l10n.moodHappy,
      'LOVING' => l10n.moodLoving,
      'MISSING' => l10n.moodMissing,
      'CALM' => l10n.moodCalm,
      'BUSY' => l10n.moodBusy,
      'SLEEPY' => l10n.moodSleepy,
      _ => code,
    };
  }

  String _statusLine(AppLocalizations l10n) {
    final parts = <String>[];
    if (_presence == 'ONLINE') {
      parts.add(l10n.presenceOnline);
    } else if (_presence == 'OFFLINE') {
      parts.add(l10n.presenceOffline);
    }
    for (final mood in _moods) {
      if (mood.userId == _partnerUserId) {
        parts.add(_moodLabel(l10n, mood.moodCode));
      }
    }
    return parts.isEmpty ? l10n.moodLabel : parts.join(' · ');
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) {
        return;
      }
      _scroll.jumpTo(_scroll.position.maxScrollExtent);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final userId = ref.watch(sessionProvider).session?.userId;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.navChat)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Text(l10n.chatServerReadable),
                ),
                if (_partnerName != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: Text(
                      l10n.chatPartnerStatus(_partnerName!, _statusLine(l10n)),
                    ),
                  ),
                if (_ping != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: Text(l10n.lovePingReceived),
                  ),
                if (_conversationId != null)
                  SizedBox(
                    height: 44,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      children: [
                        for (final code in const [
                          'HAPPY',
                          'LOVING',
                          'MISSING',
                          'CALM',
                          'BUSY',
                          'SLEEPY',
                        ])
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ActionChip(
                              label: Text(_moodLabel(l10n, code)),
                              onPressed: () => _setMood(code),
                            ),
                          ),
                        ActionChip(
                          label: Text(l10n.moodClear),
                          onPressed: () async {
                            await ref
                                .read(socialRepositoryProvider)
                                .clearMood();
                            await _refreshQuiet();
                          },
                        ),
                      ],
                    ),
                  ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                Expanded(
                  child: _conversationId == null
                      ? Center(child: Text(l10n.chatNoCouple))
                      : ListView.builder(
                          controller: _scroll,
                          padding: const EdgeInsets.all(16),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final message = _messages[index];
                            final mine = message.senderUserId == userId;
                            return Align(
                              alignment: mine
                                  ? Alignment.centerRight
                                  : Alignment.centerLeft,
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                constraints: const BoxConstraints(
                                  maxWidth: 280,
                                ),
                                decoration: BoxDecoration(
                                  color: mine
                                      ? Theme.of(context).colorScheme.primary
                                      : Theme.of(context)
                                            .colorScheme
                                            .surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text(
                                  message.body,
                                  style: TextStyle(
                                    color: mine
                                        ? Theme.of(context)
                                              .colorScheme
                                              .onPrimary
                                        : null,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                ),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _text,
                          enabled: _conversationId != null && !_sending,
                          decoration: InputDecoration(hintText: l10n.chatHint),
                          onSubmitted: (_) => _send(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: _conversationId == null ? null : _sendPing,
                        icon: const Icon(Icons.favorite_border),
                        tooltip: l10n.lovePing,
                      ),
                      IconButton(
                        onPressed: _conversationId == null || _sending
                            ? null
                            : _send,
                        icon: const Icon(Icons.send),
                        tooltip: l10n.chatSend,
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
