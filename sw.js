// Сервис-воркер «Рядом»: офлайн-оболочка приложения и приём push.
// Данные пары НЕ кэшируются здесь — они идут с сервера; кэшируется только сама оболочка.
const CACHE = 'ryadom-shell-v1';
const SHELL = ['./', 'index.html', 'app.js', 'app.css', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('config.js')) return; // настройки сервера — всегда свежие
  // сначала сеть, при её отсутствии — сохранённая оболочка
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && SHELL.some((s) => url.pathname.endsWith(s.replace('./', '/')) || url.pathname.endsWith(s))) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('index.html')))
  );
});

// Push: на экране блокировки — нейтральный текст без имён, названий и ответов.
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(
    self.registration.showNotification('Рядом', {
      body: 'В «Рядом» новое событие',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: data.tag || 'ryadom',
      silent: !!data.quiet,
      data: { url: data.url || './' },
    })
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
