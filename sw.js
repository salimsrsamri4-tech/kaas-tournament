var CACHE = 'kaas-v26';
var FILES = ['/hero_bg.jpg'];

// index.html لا يُخزّن في الكاش — يُجلب دائماً من الشبكة
var NO_CACHE = ['/', '/index.html'];

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
  var url = e.request.url;

  // API — بدون كاش
  if(url.indexOf('script.google.com') !== -1) return;

  // index.html — دائماً من الشبكة، بدون كاش
  var path = new URL(url).pathname;
  if(path === '/' || path.indexOf('index.html') !== -1){
    e.respondWith(fetch(e.request).catch(function(){ return caches.match(e.request); }));
    return;
  }

  // باقي الملفات — شبكة أولاً ثم كاش
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
