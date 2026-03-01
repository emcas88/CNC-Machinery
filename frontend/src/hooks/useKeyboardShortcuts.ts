import { useEffect } from 'react'

type ShortcutMap = Record<string, (e: KeyboardEvent) => void>

export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('ctrl')
      if (e.shiftKey) parts.push('shift')
      if (e.altKey) parts.push('alt')
      parts.push(e.key.toLowerCase())
      const combo = parts.join('+')

      if (shortcuts[combo]) {
        e.preventDefault()
        shortcuts[combo](e)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, enabled])
}
