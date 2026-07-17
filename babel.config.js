module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // WatermelonDB's legacy decorators need transform-class-properties to run
    // right after the decorators transform, but babel-preset-expo (SDK 56+) no
    // longer transforms class features (Hermes supports them natively). Scope
    // the extra transforms to app code only — node_modules (e.g. react-native
    // internals using native private methods) must stay untouched.
    overrides: [
      {
        // Function matcher, not a RegExp: Expo's transformer loads this config
        // with no filename to compute its cache key, and RegExp patterns throw
        // "no filename was passed to Babel" in that case.
        exclude: (filename) => !filename || filename.includes('node_modules'),
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
          ['@babel/plugin-transform-private-property-in-object', { loose: true }],
        ],
      },
    ],
  };
};
