import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('jarvisDesktop', {
  shell: 'electron',
  version: 'mvp-shell',
  platform: process.platform,
  mode: process.env.JARVIS_DESKTOP_MODE ?? 'production',
  devServerUrl: process.env.JARVIS_DESKTOP_URL ?? 'http://127.0.0.1:5173',
  lanAccess: process.env.JARVIS_LAN_ACCESS === '1',
  features: {
    autoBackup: true,
    schedulerPersistence: true,
    portableMode: true,
    lanAccess: process.env.JARVIS_LAN_ACCESS === '1',
  },
})
