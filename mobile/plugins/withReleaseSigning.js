// Signs release builds with the keystore named by USEUS_KEYSTORE (+ passwords / alias in the
// environment). Without it, release builds fall back to the debug key, as Expo does by default.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (System.getenv('USEUS_KEYSTORE')) {
                storeFile file(System.getenv('USEUS_KEYSTORE'))
                storePassword System.getenv('USEUS_KEYSTORE_PASSWORD')
                keyAlias System.getenv('USEUS_KEY_ALIAS')
                keyPassword System.getenv('USEUS_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes("System.getenv('USEUS_KEYSTORE')")) {
      gradle = gradle.replace(/signingConfigs\s*\{/, (m) => `${m}${RELEASE_CONFIG}`);
      // Only the release build type: its block is the one that also enables minify/shrink.
      gradle = gradle.replace(
        /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig System.getenv('USEUS_KEYSTORE') ? signingConfigs.release : signingConfigs.debug"
      );
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
