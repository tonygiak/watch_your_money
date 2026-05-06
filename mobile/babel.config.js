/**
 * Babel config — required by `jest-expo` so React Native source (which
 * still ships Flow + Hermes-flavored JS) parses cleanly under Jest.
 *
 * Pinned per ADR-0007 §5. Production bundling (Metro) reads the same
 * preset, so the test transform is faithful to what ships on device.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
