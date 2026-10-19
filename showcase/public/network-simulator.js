// Showcase only. Lets the "Under the hood" panel add latency to, or cut, the
// connection to Convex, so optimistic updates and reconnection are visible.
// It loads before the app and wraps WebSocket for Convex sync sockets only.
/* global window, setTimeout */
(() => {
  const NativeWebSocket = window.WebSocket
  let resumeAll
  let online = Promise.resolve()

  const network = window.showcaseNetwork = {
    latency: 0,
    offline: false,
    setLatency(milliseconds) {
      network.latency = milliseconds
    },
    setOffline(offline) {
      if (offline === network.offline) return
      network.offline = offline
      if (offline) online = new Promise((resolve) => { resumeAll = resolve })
      else resumeAll()
    },
  }

  // Delivers messages in order, each no earlier than latency after it was
  // queued, and holds everything while the connection is cut.
  function delayed() {
    let chain = Promise.resolve()
    return (deliver) => {
      const releaseAt = Date.now() + network.latency
      chain = chain.then(async () => {
        while (network.offline) await online
        const wait = releaseAt - Date.now()
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
        deliver()
      })
    }
  }

  window.WebSocket = class extends NativeWebSocket {
    #simulated
    #sendLater = delayed()
    #receiveLater = delayed()
    #onmessage = null

    constructor(url, protocols) {
      super(url, protocols)
      this.#simulated = /\/api\/[^/]+\/sync$/.test(String(url))
    }

    send(data) {
      if (!this.#simulated) return super.send(data)
      this.#sendLater(() => {
        if (this.readyState === NativeWebSocket.OPEN) super.send(data)
      })
    }

    get onmessage() {
      return this.#onmessage
    }

    set onmessage(handler) {
      this.#onmessage = handler
      super.onmessage = !handler || !this.#simulated
        ? handler
        : event => this.#receiveLater(() => handler.call(this, event))
    }
  }
})()
