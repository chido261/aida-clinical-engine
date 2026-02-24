// app/lib/pushStore.ts

export type WebPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

/**
 * Guarda múltiples subscriptions por userId.
 * Key: userId
 * Value: Map<endpoint, subscription>
 */
const store = new Map<string, Map<string, WebPushSubscription>>();

export function saveSubscription(userId: string, sub: WebPushSubscription) {
  if (!store.has(userId)) store.set(userId, new Map());
  store.get(userId)!.set(sub.endpoint, sub);
}

export function getSubscriptions(userId: string): WebPushSubscription[] {
  return Array.from(store.get(userId)?.values() ?? []);
}

/**
 * Compatibilidad: si aún se usa getSubscription en algún lado,
 * regresa la primera subscription disponible.
 */
export function getSubscription(userId: string) {
  return getSubscriptions(userId)[0];
}

export function removeSubscription(userId: string, endpoint: string) {
  const m = store.get(userId);
  if (!m) return;
  m.delete(endpoint);
  if (m.size === 0) store.delete(userId);
}