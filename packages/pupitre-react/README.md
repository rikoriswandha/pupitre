# @rikology/pupitre-react

React runtime for Pupitre's server-defined Inertia pages. Supply a registry created with `defineRegistry` to `<Pupitre registry={registry} />`.

## Realtime

Pass a stable, browser-side `RealtimeClient` as `<Pupitre registry={registry} realtime={client} />`. Host-owned pages can pass the same `realtime` prop to `PupitreShell`. For example, create the client once with `transmitRealtimeClient()` from `@rikology/pupitre-transmit/client`; do not recreate it on every render.

The server supplies authorized channels in shared `pupitre.realtime.userChannel` and each table's `descriptor.realtime.channel`. Notification pings reload only `pupitre`; table pings coalesce within one task and reload only the descriptor's `dataProp` (default `data`). No record payload is accepted from the realtime transport: normal authenticated Inertia requests supply fresh data.

`useRealtimeSubscription(channel, onEvent)` subscribes after mount, keeps the latest callback without resubscribing on each render, and unsubscribes on channel/client changes or unmount. Its boolean result indicates whether a client and channel are configured. `useTableRealtime(descriptor)` provides the table's coalesced partial reload behavior. Neither hook opens subscriptions during SSR.

`useNotificationsPolling(interval, onNotification?)` uses realtime when a client and user channel exist. The optional callback lets an open notification tray refresh its inbox with the same subscription, without duplicating shared-prop reloads. Without a client or channel, it retains visibility-aware polling. The default UI tables likewise retain configured polling when no realtime subscription is configured.
