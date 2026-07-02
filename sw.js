"use strict";
/* Service Worker — Le Système v3.0.0 */

const CACHE = "systeme-v3.0.0";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache d'abord, réseau en secours (app 100% offline) */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => {
          if (e.request.mode === "navigate") return caches.match("./index.html");
        });
    })
  );
});

/* Rappel quotidien best-effort (Chrome Android décide du moment) */
self.addEventListener("periodicsync", (e) => {
  if (e.tag === "daily-quests") {
    e.waitUntil(
      self.registration.showNotification("⚔ LE SYSTÈME T'ATTEND", {
        body: "Quêtes du jour à valider. Ne brise pas ta série.",
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: "daily-quests",
      })
    );
  }
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("./");
    })
  );
});
