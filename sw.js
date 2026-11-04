// Change VERSION à chaque mise à jour des fichiers pour que les téléphones rechargent la nouvelle page.
const VERSION = 'mes-papiers-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'share').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);

  // Quelqu'un a fait « Partager » vers l'appli : on met les fichiers de côté et on ouvre la page.
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const c = await caches.open('share');
        const put = (blob, name, kind) => c.put(
          self.registration.scope + 'shared/' + Date.now() + '-' + Math.random().toString(36).slice(2),
          new Response(blob, {headers: {'Content-Type': blob.type || 'application/octet-stream', 'X-Name': encodeURIComponent(name), 'X-Kind': kind}})
        );
        for (const f of fd.getAll('files')) if (f && f.size) await put(f, f.name || 'Document', 'file');
        const text = [fd.get('title'), fd.get('text')].filter(Boolean).join('\n');
        if (text) await put(new Blob([text], {type: 'text/plain'}), 'Note', 'note');
      } catch (err) {}
      return Response.redirect('./?share=1', 303);
    })());
    return;
  }

  // Le reste : on sert la copie gardée sur le téléphone (marche sans réseau), sinon le réseau.
  if (req.method === 'GET' && url.origin === location.origin) {
    e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req)));
  }
});
