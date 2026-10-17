// Service worker khusus /dashboard. Sengaja minim: hanya supaya browser menganggap
// dashboard "installable" (muncul tombol/pop-up Instal). Tidak meng-cache halaman atau
// data API, karena percakapan/pesanan di dashboard harus selalu versi terbaru.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Tidak ada cache sama sekali — setiap request diteruskan langsung ke jaringan seperti biasa.
self.addEventListener('fetch', () => {});
