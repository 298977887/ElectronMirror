// mirror_test2/src/renderer/src/components/CameraComponent/index.tsx
import { useState, useEffect, useRef } from 'react'
import './styles.css'

interface CameraComponentProps {
  onError: (message: string) => void
}

const CameraComponent = ({ onError }: CameraComponentProps): JSX.Element => {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoStreamRef = useRef<MediaStream | null>(null)
  
  // 请求摄像头权限并设置视频显示
  useEffect(() => {
    const setupCamera = async () => {
      try {
        // 请求摄像头权限
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 320 }, 
            height: { ideal: 240 } 
          } 
        })
        videoStreamRef.current = stream
        
        // 将视频流绑定到视频元素
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setIsCameraActive(true)
          }
        }
      } catch (error) {
        console.error('摄像头访问错误:', error)
        onError('无法访问摄像头，请检查权限设置')
      }
    }
    
    setupCamera()
    
    // 组件卸载时清理资源
    return () => {
      // 停止摄像头流
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [onError])
  
  return (
    <div className="camera-component">
      <div className={`video-container ${isCameraActive ? 'active' : ''}`}>
        <video ref={videoRef} className="video-element" muted playsInline />
        
        {/* 摄像头状态指示器 */}
        <div className="camera-status">
          <div className={`status-indicator ${isCameraActive ? 'active' : ''}`}>
            <span className="status-dot"></span>
            摄像头 {isCameraActive ? '已连接' : '未连接'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CameraComponent