import { useEffect } from 'react'
import PetWindow from './components/PetWindow'
import SettingsWindow from './components/SettingsWindow'
import ChatWindow from './components/ChatWindow'

function App() {
  useEffect(() => {
    const mode = localStorage.getItem('theme-mode') || 'light'
    document.documentElement.setAttribute('data-theme', mode)
  }, [])

  const hash = window.location.hash

  if (hash === '#/pet') {
    return <PetWindow />
  }

  if (hash === '#/settings') {
    return <SettingsWindow />
  }

  // 默认：聊天窗口
  return <ChatWindow />
}

export default App
