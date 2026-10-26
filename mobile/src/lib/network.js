// Connectivity watcher (NetInfo). Walking out of the house flips Wi-Fi → 4G/5G: the old
// sockets die silently, so rooms listen here and rebuild their channels the moment a
// network is back instead of waiting for heartbeats to time out.
import NetInfo from '@react-native-community/netinfo';

let online = true;
let lastType = null;
const listeners = new Set();

const isUp = (s) => !!s.isConnected && s.isInternetReachable !== false;

NetInfo.addEventListener((s) => {
  const up = isUp(s);
  const switched = up && lastType !== null && s.type !== lastType; // e.g. wifi → cellular
  const regained = up && !online;
  online = up;
  if (up) lastType = s.type;
  if (regained || switched) listeners.forEach((fn) => fn({ regained, switched, type: s.type }));
});

export const isOnline = () => online;

// Calls `fn` whenever connectivity comes back or moves to another network.
export function onNetworkChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
