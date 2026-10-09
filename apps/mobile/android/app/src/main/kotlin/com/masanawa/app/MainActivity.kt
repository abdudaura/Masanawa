package com.masanawa.app

import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import kotlin.math.max

class MainActivity : FlutterActivity() {
    private var liveAudioTrack: AudioTrack? = null
    private var liveSampleRate: Int? = null
    private var deepLinkChannel: MethodChannel? = null
    @Volatile private var destroyed = false

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        deepLinkChannel = MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "masanawa/deep_links",
        ).also { channel ->
            channel.setMethodCallHandler { call, result ->
                if (call.method == "initial") {
                    val uri = intent?.takeIf { it.action == Intent.ACTION_VIEW }?.data
                    result.success(uri?.takeIf(::isSupportedDeepLink)?.toString())
                    // Only deliver the launch intent once across reinitialization.
                    intent?.data = null
                } else {
                    result.notImplemented()
                }
            }
        }

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            "masanawa/live_pcm",
            io.flutter.plugin.common.StandardMethodCodec.INSTANCE,
            flutterEngine.dartExecutor.binaryMessenger.makeBackgroundTaskQueue(),
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
                            result.success(writeLivePcm(bytes))
                        }
                    }
                }

                "stop" -> {
                    stopLivePcm()
                    result.success(true)
                }

                "release" -> {
                    stopLivePcm()
                    restoreAudioRoute()
                    result.success(true)
                }

                "speaker" -> {
                    val enabled = call.argument<Boolean>("enabled") ?: true
                    result.success(setSpeakerRoute(enabled))
                }

                else -> result.notImplemented()
            }
        }
    }

    @Synchronized
    private fun startLivePcm(sampleRate: Int): Boolean {
        if (destroyed) return false
        if (sampleRate !in 8000..48000) return false
        val existing = liveAudioTrack
        if (existing != null && liveSampleRate == sampleRate &&
            existing.state == AudioTrack.STATE_INITIALIZED &&
            existing.playState == AudioTrack.PLAYSTATE_PLAYING
        ) return true
        stopLivePcm()

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
        liveSampleRate = sampleRate
        track.play()
        return true
    }

    @Suppress("DEPRECATION")
    private fun setSpeakerRoute(enabled: Boolean): Boolean {
        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        return try {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.isSpeakerphoneOn = enabled
            true
        } catch (_: RuntimeException) {
            false
        }
    }

    @Synchronized
    private fun writeLivePcm(bytes: ByteArray): Boolean {
        val track = liveAudioTrack ?: return false
        if (track.state != AudioTrack.STATE_INITIALIZED) return false
        var offset = 0
        try {
            while (offset < bytes.size) {
                val written = track.write(bytes, offset, bytes.size - offset,
                    AudioTrack.WRITE_BLOCKING)
                if (written <= 0) return false
                offset += written
            }
            return true
        } catch (_: RuntimeException) {
            return false
        }
    }

    @Synchronized
    private fun stopLivePcm() {
        val track = liveAudioTrack ?: return
        liveAudioTrack = null
        liveSampleRate = null
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val uri = intent.data
        if (intent.action == Intent.ACTION_VIEW && isSupportedDeepLink(uri)) {
            deepLinkChannel?.invokeMethod("open", uri.toString())
            intent.data = null
        }
    }

    private fun isSupportedDeepLink(uri: Uri?): Boolean {
        uri ?: return false
        if (uri.scheme == "masanawa") return true
        if (uri.scheme != "https" || !uri.host.equals("masanawa.com", ignoreCase = true)) {
            return false
        }
        if (uri.port != -1) return false
        val segments = uri.pathSegments
        return segments.size == 2 && segments[0] == "twin" && segments[1].isNotBlank()
    }

    override fun onDestroy() {
        destroyed = true
        stopLivePcm()
        restoreAudioRoute()
        deepLinkChannel?.setMethodCallHandler(null)
        deepLinkChannel = null
        super.onDestroy()
    }

    private fun restoreAudioRoute() {
        @Suppress("DEPRECATION")
        (getSystemService(AUDIO_SERVICE) as AudioManager).apply {
            isSpeakerphoneOn = false
            mode = AudioManager.MODE_NORMAL
        }
    }
}

