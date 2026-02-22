/* public/sw.js */

// Escucha notificaciones push
self.addEventListener("push", (event) => {
    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      data = { title: "AIDA", body: event.data ? event.data.text() : "Notificación" };
    }
  
    const title = data.title || "AIDA";
    const options = {
      body: data.body || "Tienes una notificación",
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
      data: data.url ? { url: data.url } : {},
    };
  
    event.waitUntil(self.registration.showNotification(title, options));
  });
  
  // Al tocar la notificación, abrir la app (o enfocar una pestaña existente)
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
  
    const targetPath = event.notification?.data?.url || "/chat";
    const targetUrl = new URL(targetPath, self.location.origin).href;
  
    event.waitUntil(
      (async () => {
        const allClients = await clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
  
        // 1) Si ya hay una pestaña en /chat, enfócala
        for (const client of allClients) {
          if (client.url.startsWith(targetUrl) || client.url.includes(targetPath)) {
            if ("focus" in client) return client.focus();
          }
        }
  
        // 2) Si no existe, abrir nueva pestaña
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })()
    );
  });