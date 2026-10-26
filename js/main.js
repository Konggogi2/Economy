import { render, go, setTab } from './screens.js';
import { store } from './store.js';
import { UNITS } from './data/index.js';
import { CALCS } from './data/calcs.js';

render();
window.__app = { store, UNITS, go, setTab };
window.__calcCount = CALCS.length;

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
