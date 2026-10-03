package ng.unigeria.unigeria

import android.speech.tts.TextToSpeech
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.Locale

class MainActivity : FlutterActivity() {
    private var tts: TextToSpeech? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        tts = TextToSpeech(this) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.getDefault()
            }
        }

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "masanawa/alpha_tts",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "speak" -> {
                    val text = call.argument<String>("text")?.trim().orEmpty()
                    val language = call.argument<String>("language")?.trim().orEmpty()
                    if (language.isNotEmpty()) {
                        tts?.language = Locale.forLanguageTag(language)
                    }
                    if (text.isNotEmpty()) {
                        tts?.speak(
                            text,
                            TextToSpeech.QUEUE_FLUSH,
                            null,
                            "masanawa-alpha",
                        )
                    }
                    result.success(text.isNotEmpty())
                }
                "stop" -> {
                    tts?.stop()
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }
}
