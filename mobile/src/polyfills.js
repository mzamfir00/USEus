// Hermes (React Native 0.76) has no structuredClone; the shared engine clones plain JSON state.
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
}
