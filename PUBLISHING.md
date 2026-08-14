# Publishing Denver Tamil Church Mobile

The mobile app bundles the public Denver Tamil Church website and preserves its pages, bilingual content, events, gallery, giving, live stream, contact links, chatbot, and media. The local desktop Media Manager is intentionally not shipped because it writes directly to the website source folder and is not a public/mobile feature.

## Sync website updates

Run `npm run sync` after changing `C:\Users\HP\.vscode\DTC App`. This copies the public site into `www` and then into the Android project.

## Android release

1. Install Android Studio with Android SDK 36 and Java 21.
2. Create/secure a Play upload keystore. Never commit it.
3. Set `DTC_KEYSTORE_FILE`, `DTC_KEYSTORE_PASSWORD`, `DTC_KEY_ALIAS`, and `DTC_KEY_PASSWORD`.
4. Increment `versionCode` and `versionName` in `android/app/build.gradle`.
5. Run `npm run android:bundle` from the project root. This uses the project-local Java 21 toolchain and Windows-safe Gradle settings.
6. Upload `android/app/build/outputs/bundle/release/app-release.aab` to Play Console.

Package ID: `org.denvertamilchurch.app`.

## Store information still owned by the publisher

- Google Play Console account
- signing certificates/keys and legal agreements
- privacy policy/support URLs
- screenshots, descriptions, category, age-rating answers, and data-safety declarations
- final physical-device review of calling, email, maps, giving, YouTube, rotation, and offline fallback

The app requests internet access only. It has no advertising SDK, analytics SDK, location permission, camera permission, microphone permission, user account, or in-app purchase system.
