import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const WS_PATH = '/ws/rooms/'

export function useRoomSocket() {
  const queryClient = useQueryClient()
  const wsRef      = useRef<WebSocket | null>(null)
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef = useRef(0)
  const unmounted  = useRef(false)

  const connect = () => {
    if (unmounted.current) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}${WS_PATH}`
    const ws  = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      retriesRef.current = 0
    }

    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string)
        if (msg.type === 'room_status_update') {
          queryClient.invalidateQueries({ queryKey: ['rooms'] })
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        }
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      if (unmounted.current) return
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000)
      retriesRef.current += 1
      retryRef.current = setTimeout(connect, delay)
    }
  }

  useEffect(() => {
    unmounted.current = false
    connect()
    return () => {
      unmounted.current = true
      if (retryRef.current) clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
}
