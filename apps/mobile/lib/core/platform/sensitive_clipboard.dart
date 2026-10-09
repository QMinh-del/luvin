import 'package:flutter/services.dart';

class SensitiveClipboard {
  const SensitiveClipboard();

  static const _androidChannel = MethodChannel(
    'com.luvin.app/sensitive_clipboard',
  );

  Future<bool> copy({required String text, required String label}) async {
    var systemConfirmsCopy = false;
    try {
      systemConfirmsCopy =
          await _androidChannel.invokeMethod<bool>('copySensitiveText', {
            'text': text,
            'label': label,
          }) ??
          false;
    } on MissingPluginException {
      await Clipboard.setData(ClipboardData(text: text));
    } on PlatformException {
      await Clipboard.setData(ClipboardData(text: text));
    }
    await HapticFeedback.mediumImpact();
    return systemConfirmsCopy;
  }
}
