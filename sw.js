// 자동 생성 (tools/make_sw.mjs). 수정하지 마세요.
const CACHE = 'moneylab-vmvocxss9';
const FILES = [
 "./",
 "./css/style.css",
 "./icons/icon-180.png",
 "./icons/icon-192.png",
 "./icons/icon-512.png",
 "./icons/icon-maskable-512.png",
 "./icons/icon.svg",
 "./index.html",
 "./js/chart.js",
 "./js/data/c1.js",
 "./js/data/c2.js",
 "./js/data/c3.js",
 "./js/data/c4.js",
 "./js/data/c5.js",
 "./js/data/c6.js",
 "./js/data/c7.js",
 "./js/data/calcs.js",
 "./js/data/dsl.js",
 "./js/data/glossary.js",
 "./js/data/index.js",
 "./js/data/labdefs.js",
 "./js/data/tune.js",
 "./js/fin.js",
 "./js/gen.js",
 "./js/labs.js",
 "./js/lessonq.js",
 "./js/main.js",
 "./js/pq.js",
 "./js/qs.js",
 "./js/screens.js",
 "./js/store.js",
 "./js/tv.js",
 "./js/util.js",
 "./manifest.webmanifest"
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match('./index.html'))));
});
