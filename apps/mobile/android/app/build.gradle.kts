plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "ng.unigeria.unigeria"
    // flutter_secure_storage v11 compiles against SDK 37; keep compileSdk pinned
    // to 37 so the plugin's AAR metadata check passes (AGP 9.0.1 warns 37 is
    // above its recommended max but compiles fine).
    compileSdk = 37
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Application ID is reserved for the Masanawa shell (ng.unigeria.unigeria).
        applicationId = "ng.unigeria.unigeria"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // BLOCKING FOR STORE (U-SHELL-03): debug keys only for local
            // `flutter run --release`. Before Play upload, add key.properties +
            // release keystore and wire signingConfigs.release here. Do NOT
            // publish an APK signed with debug keys.
            signingConfig = signingConfigs.getByName("debug")
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

flutter {
    source = "../.."
}
