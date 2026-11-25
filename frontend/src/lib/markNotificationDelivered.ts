import { fetchApi } from '@/lib/fetchApi'

/**
 * Pose deliveredAt côté serveur (idempotent). Fire-and-forget safe.
 * Ne jette jamais — échec réseau silencieux.
 */
export async function markNotificationDelivered(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId || typeof notificationId !== 'string') return
  try {
    await fetchApi(`/api/v2/notifications/${notificationId}/delivered`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    /* silencieux */
  }
}
