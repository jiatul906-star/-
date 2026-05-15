import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { createChatWindow } from './windows/chat'
import { registerIpc } from './ipc'

let chatWindow: BrowserWindow | null = null

function bootstrap() {
  chatWindow = createChatWindow()
  registerIpc()
}

app.whenReady().then(bootstrap)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) bootstrap()
})
