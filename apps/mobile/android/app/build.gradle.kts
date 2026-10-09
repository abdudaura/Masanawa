import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Local release APKs may use debug signing for handset testing. Store AABs
// must never silently fall back to debug signing.
// Supply -PmasanawaStoreRelease=true when building a distributable package.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

val storeReleaseRequested = providers.gradleProperty("masanawaStoreRelease")
    .map { it.equals("true", ignoreCase = true) }
    .getOrElse(false)
val bundleReleaseRequested = gradle.startParameter.taskNames.any { task ->
    task.substringAfterLast(':').equals("bundleRelease", ignoreCase = true)
}
val requiresStoreSigning = storeReleaseRequested || bundleReleaseRequested

if (requiresStoreSigning) {
    val requiredFields = listOf("keyAlias", "keyPassword", "storeFile", "storePassword")
    val missingFields = requiredFields.filter { key ->
        keystoreProperties.getProperty(key).isNullOrBlank()
    }
    check(keystorePropertiesFile.isFile && missingFields.isEmpty()) {
        "Store release requires android/key.properties with valid signing fields; " +
            "missing: " + (if (!keystorePropertiesFile.isFile) "key.properties" else missingFields.joinToString())
    }
    val configuredStore = file(keystoreProperties.getProperty("storeFile"))
    check(configuredStore.isFile) {
        "Store release signing keystore does not exist at the configured storeFile path."
    }
    check(!configuredStore.name.equals("debug.keystore", ignoreCase = true)) {
        "Store release cannot use the Android debug keystore."
    }
}

android {
    namespace = "com.masanawa.app"
    // Current Android plugins require API 37 at compile time. Runtime support
    // remains governed by minSdk/targetSdk; compileSdk only exposes newer APIs
    // to the compiler.
    compileSdk = 37
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Application ID is reserved for the Masanawa consumer app.
        applicationId = "com.masanawa.app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        // video_player 2.14.x requires Android API 24+.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Debug fallback is only for local APK testing. bundleRelease and
            // explicitly marked store builds require a configured private key.
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
        checkDependencies = false
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

flutter {
    source = "../.."
}
