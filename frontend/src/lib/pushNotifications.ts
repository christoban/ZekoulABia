export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/v2/push/vapid-public-key')
    if (!res.ok) return null
    const body = await res.json()
    return body?.data?.publicKey ?? null
  } catch {
    return null
  }
}

export async function subscribeDevice(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  try {
    const publicKey = await getVapidPublicKey()
    if (!publicKey) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    return subscription
  } catch {
    return null
  }
}

export async function unsubscribeDevice(
  registration: ServiceWorkerRegistration,
): Promise<boolean> {
  try {
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return true

    const ok = await subscription.unsubscribe()
    return ok
  } catch {
    return false
  }
}

export async function sendSubscriptionToServer(subscription: PushSubscription, userAgent?: string): Promise<boolean> {
  try {
    const subJson = subscription.toJSON()
    const res = await fetch('/api/v2/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        userAgent: userAgent || navigator.userAgent,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendUnsubscribeToServer(subscription: PushSubscription): Promise<boolean> {
  try {
    const subJson = subscription.toJSON()
    const res = await fetch('/api/v2/push/unsubscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ endpoint: subJson.endpoint }),
    })
    return res.ok
  } catch {
    return false
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  // new Uint8Array(length) alloue toujours un ArrayBuffer réel (jamais SharedArrayBuffer) —
  // annotation explicite requise car lib.dom.d.ts récent infère ArrayBufferLike par défaut,
  // plus large que ce que PushSubscriptionOptionsInit.applicationServerKey accepte.
  const outputArray: Uint8Array<ArrayBuffer> = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
