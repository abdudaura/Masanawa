package ng.unigeria.unigeria

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import kotlin.math.max

class MainActivity : FlutterActivity() {
    private var liveAudioTrack: AudioTrack? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "masanawa/live_pcm",
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "start" -> {
                    val sampleRate = call.argument<Int>("sampleRate") ?: 24000
                    result.success(startLivePcm(sampleRate))
                }

                "write" -> {
                    val bytes = call.argument<ByteArray>("bytes")
                    if (bytes == null || bytes.isEmpty()) {
                        result.success(false)
                    } else {
                        val track = liveAudioTrack
                        if (track == null ||
                            track.state != AudioTrack.STATE_INITIALIZED
                        ) {
                            result.success(false)
                        } else {
                            val written = track.write(
                                bytes,
                                0,
                                bytes.size,
                                AudioTrack.WRITE_BLOCKING,
                            )
                            result.success(written == bytes.size)
                        }
                    }
                }

                "stop" -> {
                    stopLivePcm()
                    result.success(true)
                }

                else -> result.notImplemented()
            }
        }
    }

    private fun startLivePcm(sampleRate: Int): Boolean {
        stopLivePcm()
        if (sampleRate !in 8000..48000) return false

        val minBuffer = AudioTrack.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        if (minBuffer <= 0) return false

        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build()

        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()

        val track = AudioTrack(
            attributes,
            format,
            max(minBuffer * 2, sampleRate / 2),
            AudioTrack.MODE_STREAM,
            AudioManager.AUDIO_SESSION_ID_GENERATE,
        )
        if (track.state != AudioTrack.STATE_INITIALIZED) {
            track.release()
            return false
        }

        liveAudioTrack = track
        track.play()
        return true
    }

    private fun stopLivePcm() {
        val track = liveAudioTrack ?: return
        liveAudioTrack = null
        try {
            track.pause()
            track.flush()
            track.stop()
        } catch (_: IllegalStateException) {
            // Track may already be stopped by the platform.
        } finally {
            track.release()
        }
    }

    override fun onDestroy() {
        stopLivePcm()
        super.onDestroy()
    }
}
