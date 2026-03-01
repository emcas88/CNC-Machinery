import { useEffect } from 'react'

/**
 * Stub hook for real-time propagation via WebSocket / Supabase Realtime.
 * In production, subscribe to a channel and call onUpdate with incoming payloads.
 */
export function useRealtimePropagation<T>(
  channel: string,
  onUpdate: (payload: T) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return
    // TODO: connect to Supabase Realtime channel
    // const sub = supabase.channel(channel).on('broadcast', ..., onUpdate).subscribe()
    // return () => sub.unsubscribe()
  }, [channel, onUpdate, enabled])
}
