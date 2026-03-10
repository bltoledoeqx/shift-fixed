import { useState, useEffect } from 'react';

async function getVapidKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid-public-key');
    const data = await res.json();
    return data.publicKey || null;
  } catch { return null; }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setState(sub ? 'subscribed' : 'unsubscribed');
      });
    });
  }, []);

  const subscribe = async () => {
    setState('loading');
    setError(null);
    try {
      const vapidKey = await getVapidKey();
      if (!vapidKey) throw new Error('VAPID key not available');

      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });

      setState('subscribed');
    } catch (err) {
      setError((err as Error).message);
      setState('unsubscribed');
    }
  };

  const unsubscribe = async () => {
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState('unsubscribed');
    } catch (err) {
      setError((err as Error).message);
      setState('subscribed');
    }
  };

  return { state, error, subscribe, unsubscribe };
}
