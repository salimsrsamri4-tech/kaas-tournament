var CACHE = 'kaas-v8';
var FILES = ['/', '/index.html', '/hero_bg.jpg'];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(FILES); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e){
  // للـ API لا نستخدم الكاش
  if(e.request.url.indexOf('script.google.com') !== -1) return;
  e.respondWith(
    fetch(e.request)
      .then(function(res){
        var clone = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
        return res;
      })
      .catch(function(){
        return caches.match(e.request);
      })
  );
});
