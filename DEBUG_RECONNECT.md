# Debug: Interface keeps showing "Reconnecting (attempt 1)"

## Problem
The Interface chat app (Vite + React) keeps showing "Reconnecting (attempt 1)" repeatedly. This started after recent changes to `src/gateway.ts`.

## Recent changes (check these first)
- Commit `4627442` — disabled keepalive (current state)
- Commit `c177c2d` — tried status request keepalive 
- Commit `a386929` — added ping keepalive (broke things)

## Key file
`src/gateway.ts` — WebSocket client. All connection logic lives here.

## What to investigate
1. Read `src/gateway.ts` carefully — look for anything that would cause repeated disconnects
2. Check the `startKeepalive()` method — it's supposed to be disabled but verify
3. Check if the `maxReconnectAttempts` change (10→50) or any other change is causing issues
4. Look at `handleMessage()` — are there unhandled message types causing errors?
5. Check if the gateway is actually closing the connection or if the client is doing it
6. Check `useGateways.ts` for anything that might be triggering reconnects from React side

## The gateway protocol
- Messages are `{ type: 'req', id, method, params }` for requests
- Responses are `{ type: 'res', id, ok, payload }` 
- Events are `{ type: 'event', event, payload }`
- First message from gateway is `connect.challenge` event
- Client responds with `connect` request

## What to fix
- Make the WebSocket connection stable — no repeated disconnects
- If keepalive is needed, find the right approach (maybe just don't send anything and let the connection idle — the gateway may have its own keepalive)
- The app was working fine before commit `a386929` — compare against the state before that commit

## Files you can read
- `src/gateway.ts` — WebSocket client
- `src/hooks/useGateways.ts` — React hook that manages gateway connections
- `src/components/ChatView.tsx` — shows the reconnecting status

## When done
Run: `touch .reconnect_fixed`
