import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  servers: [],
  loading: false,

  setServers: (servers) => set({ servers }),
  updateServer: (server) => set(state => ({
    servers: state.servers.map(s => s.id === server.id ? { ...s, ...server } : s),
  })),
  addServer: (server) => set(state => ({ servers: [...state.servers, server] })),
  removeServer: (id) => set(state => ({ servers: state.servers.filter(s => s.id !== id) })),

  fetchServers: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/servers')
      if (res.ok) {
        const servers = await res.json()
        set({ servers })
      }
    } finally {
      set({ loading: false })
    }
  },
}))
