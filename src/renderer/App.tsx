import PetWindow from './components/PetWindow'
import SettingsWindow from './components/SettingsWindow'
import ChatWindow from './components/ChatWindow'

function App() {
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
