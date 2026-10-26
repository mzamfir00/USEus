// app.json plus what CI sets per build: the version and release signing.
module.exports = ({ config }) => ({
  ...config,
  version: process.env.USEUS_VERSION_NAME || config.version,
  android: {
    ...config.android,
    versionCode: Number(process.env.USEUS_VERSION_CODE) || config.android.versionCode,
  },
  plugins: [...config.plugins, './plugins/withReleaseSigning'],
});
