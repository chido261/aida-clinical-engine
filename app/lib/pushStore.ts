// app/lib/pushStore.ts

export type WebPushSubscription = {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  
  const store = new Map<string, WebPushSubscription>();
  
  export function saveSubscription(userId: string, sub: WebPushSubscription) {
    store.set(userId, sub);
  }
  
  export function getSubscription(userId: string) {
    return store.get(userId);
  }