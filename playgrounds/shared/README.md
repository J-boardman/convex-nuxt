# Shared Relay presentation

`@j-boardman/convex-playground-shared` is a private workspace package used by
the Vue and Nuxt playgrounds. It owns:

- the `RelayExperience` presentational component;
- plain person, post, message, runtime, and async-state view models; and
- the responsive visual system for the feed, chat, runtime badge, and receipt.

It does not own a Convex client, composables, auth, routing, SSR payloads, or
error policy. `RelayExperience` accepts data as props and emits product intent:
create a post, set a reaction state, send a message, or load more. The Vue and
Nuxt containers translate those events through their respective public package
APIs.

Pass `runtime="vue"` or `runtime="nuxt"` to select the accent and visible
runtime label. Use the receipt slots for integration-specific evidence. Keep
meaningful differences there instead of adding framework branches to the
shared component.
