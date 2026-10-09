package com.luvin.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "com.luvin.app/sensitive_clipboard",
        ).setMethodCallHandler { call, result ->
            if (call.method != "copySensitiveText") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            val text = call.argument<String>("text")
            val label = call.argument<String>("label")
            if (text.isNullOrEmpty() || label.isNullOrEmpty()) {
                result.error("INVALID_ARGUMENT", "Text and label are required.", null)
                return@setMethodCallHandler
            }
            val clip = ClipData.newPlainText(label, text)
            clip.description.extras = PersistableBundle().apply {
                putBoolean("android.content.extra.IS_SENSITIVE", true)
            }
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(clip)
            result.success(Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
        }
    }
}
