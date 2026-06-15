module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for react-native-worklets-core to compile 'worklet' functions
      // This MUST be listed before any other plugins
      'react-native-worklets-core/plugin',
    ],
  };
};
