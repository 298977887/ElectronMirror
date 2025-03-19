// mirror_test2/src/renderer/src/App.tsx
import { useState } from 'react'
import './App.css'
import AudioVisualizer from './components/AudioVisualizer'
import CameraComponent from './components/CameraComponent'

function App(): JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string>('')
  
  // IPC测试函数 - 保留原本的IPC测试功能
  const ipcHandle = (): void => {
    window.electron.ipcRenderer.send('ping')
    console.log('IPC message sent')
  }

  return (
    <div className="mirror-container">
      {/* 顶部区域 - 用于错误提示 */}
      <div className="mirror-top">
        {errorMessage && <div className="error-message">{errorMessage}</div>}
      </div>
      
      {/* 中央区域 - 分为摄像头和音频可视化 */}
      <div className="mirror-center">
        <div className="mirror-components">
          {/* 摄像头组件 */}
          <CameraComponent 
            onError={(message: string) => setErrorMessage(message)} 
          />
          
          {/* 音频可视化组件 */}
          <AudioVisualizer 
            onError={(message: string) => setErrorMessage(message)}
          />
        </div>
      </div>
      
      {/* 底部区域 - 用于额外信息和控制 */}
      <div className="mirror-bottom">
        <div className="action-button" onClick={ipcHandle}>
          Send IPC
        </div>
      </div>
    </div>
  )
}

export default App