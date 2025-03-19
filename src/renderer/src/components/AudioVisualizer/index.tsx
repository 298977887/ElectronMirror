// AudioVisualizer/index.tsx
import React, { useEffect, useRef, useState } from 'react'
import './styles.css'

/**
 * 音频可视化组件
 * 功能：通过麦克风输入生成动态音频波形可视化效果
 */
const AudioVisualizer: React.FC = () => {
  // ============= 状态管理 =============
  const [isListening, setIsListening] = useState<boolean>(false) // 麦克风监听状态
  const [error, setError] = useState<string | null>(null) // 错误信息
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null) // 音频上下文
  const [_analyser, setAnalyser] = useState<AnalyserNode | null>(null) // 音频分析器

  // ============= Refs引用 =============
  const canvasRef = useRef<HTMLCanvasElement>(null) // Canvas元素引用
  const animationRef = useRef<number | null>(null) // 动画帧引用
  const mediaStreamRef = useRef<MediaStream | null>(null) // 媒体流引用
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null) // 音频源引用

  // ============= 可视化参数配置 =============
  const NUM_LINES = 8 // 波形线条数量
  const NOISE_THRESHOLD = 10 // 噪音阈值（0-255）
  const LINE_WIDTH = 1.2 // 基础线条宽度
  const MAX_AMPLITUDE = 300 // 最大振幅
  const IDLE_AMPLITUDE = 10 // 闲置状态振幅

  // ============= 动画状态管理 =============
  const animationStateRef = useRef({
    phase: 0, // 波形相位（用于产生运动效果）
    baseAmplitude: IDLE_AMPLITUDE, // 基础振幅（动态调整）
    rotationAngle: 0, // 旋转角度（用于X轴变形）
    rotationSpeed: 20, // 旋转速度（值越小越慢）
    breathPhase: 0, // 呼吸效果相位（用于振幅脉动）
    breathSpeed: 20, // 呼吸速度（值越小越慢）
    active: false, // 是否检测到有效音频输入
    targetAmplitude: IDLE_AMPLITUDE // 目标振幅（用于平滑过渡）
  })

  // ============= 生命周期管理 =============
  useEffect(() => {
    /**
     * 初始化音频设备
     * 1. 请求麦克风权限
     * 2. 创建音频分析器
     * 3. 连接音频处理节点
     */
    const initAudio = async () => {
      try {
        // 获取麦克风媒体流
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream

        // 创建音频上下文和分析器
        const context = new (window.AudioContext || (window as any).webkitAudioContext)()
        const audioAnalyser = context.createAnalyser()

        // 配置分析器参数
        audioAnalyser.fftSize = 2048 // 快速傅里叶变换尺寸
        audioAnalyser.smoothingTimeConstant = 0.85 // 平滑系数（0-1）

        // 创建音频源并连接分析器
        const source = context.createMediaStreamSource(stream)
        source.connect(audioAnalyser)
        sourceRef.current = source

        // 更新状态并开始绘制
        setAudioContext(context)
        setAnalyser(audioAnalyser)
        setIsListening(true)
        startDrawing(audioAnalyser)
      } catch (err) {
        // 错误处理
        console.error('麦克风访问错误:', err)
        if ((err as Error).name === 'NotAllowedError') {
          setError('请允许访问麦克风以启用音频可视化')
        } else if ((err as Error).name === 'NotFoundError') {
          setError('未检测到麦克风设备')
        } else {
          setError('音频初始化失败，请检查设备设置')
        }
      }
    }

    initAudio()

    // 组件卸载时清理资源
    return () => cleanupAudio()
  }, [])

  // ============= 波形绘制核心逻辑 =============
  /**
   * 开始绘制音频波形
   * @param audioAnalyser 音频分析器节点
   */
  const startDrawing = (audioAnalyser: AnalyserNode) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 创建数据存储数组
    const bufferLength = audioAnalyser.frequencyBinCount // 频率数据长度
    const dataArray = new Uint8Array(bufferLength) // 频率数据容器

    /**
     * 波形绘制函数（递归调用形成动画）
     */
    const drawWaveforms = () => {
      // 自适应画布尺寸
      const container = canvas.parentElement
      if (container) {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
      }

      // 请求下一帧动画
      animationRef.current = requestAnimationFrame(drawWaveforms)

      // 获取当前频率数据
      audioAnalyser.getByteFrequencyData(dataArray)

      // 计算平均音量（用于状态判断）
      let sum = 0
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i]
      const average = sum / bufferLength

      // 更新动画状态
      const state = animationStateRef.current
      state.phase += 0.01 // 相位递增产生波形运动
      state.breathPhase += state.breathSpeed // 呼吸相位递增
      state.rotationAngle += state.rotationSpeed // 旋转角度递增

      // 活动状态判断（是否超过噪音阈值）
      state.active = average > NOISE_THRESHOLD + 5
      // 目标振幅计算（活动时取平均值，非活动时回到闲置状态）
      state.targetAmplitude = state.active ? Math.min(MAX_AMPLITUDE, average * 0.5) : IDLE_AMPLITUDE
      // 振幅平滑过渡（避免突变）
      state.baseAmplitude += (state.targetAmplitude - state.baseAmplitude) * 0.1

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 计算画布中心点
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      // ============= 核心绘制逻辑 =============
      // 循环绘制每条波形线
      for (let lineIndex = 0; lineIndex < NUM_LINES; lineIndex++) {
        // 计算角度偏移（使线条均匀分布）
        const angleOffset = (lineIndex / NUM_LINES) * Math.PI

        // 创建横向渐变（实现两端透明效果）
        // 修改后 ↓↓↓
        const gradient = ctx.createLinearGradient(
          centerX - canvas.width * 0.35, // 左边界（画布宽度40%位置）
          centerY,
          centerX + canvas.width * 0.35, // 右边界（画布宽度60%位置）
          centerY
        )
        // 四段式渐变实现平滑过渡
        gradient.addColorStop(0, 'rgba(255,255,255,0)') // 最左端完全透明
        gradient.addColorStop(0.35, 'rgba(255,255,255,0.8)');  // 中间区域起点
        gradient.addColorStop(0.65, 'rgba(255,255,255,0.8)');  // 中间区域终点
        gradient.addColorStop(1, 'rgba(255,255,255,0)') // 最右端完全透明

        // 设置绘制样式
        ctx.strokeStyle = gradient
        ctx.lineWidth = LINE_WIDTH
        ctx.lineCap = 'round' // 线条端点为圆形

        // 开始路径绘制
        ctx.beginPath()

        // 生成128个点组成平滑曲线
        const points = 128
        for (let i = 0; i <= points; i++) {
          const t = i / points // 标准化位置（0-1）

          // ===== 振幅计算 =====
          // 边缘衰减因子（二次方曲线，两端趋近于0）
          const edgeFactor = Math.pow(4 * t * (1 - t), 0.5) // 提升到3次方加速衰减
          // ===== 中间区域增幅计算 =====
          // 使用三次方曲线增强中间30%区域的响应
          const midBoost = Math.pow(Math.sin(t * Math.PI), 3) * 1.5 // 中间增益系数
          const enhancedEdgeFactor = edgeFactor * (1 + midBoost) // 增强后的边缘因子

          // 基础振幅计算（应用边缘衰减）
          let amplitude = state.baseAmplitude * enhancedEdgeFactor; // 使用增强后的边缘因子
          //let amplitude = state.baseAmplitude * edgeFactor

          // 呼吸效果（使振幅有轻微脉动）
          amplitude *= 1 + Math.sin(state.breathPhase) * 0.01

          // ===== 波形计算 =====
          let waveformValue = 0
          if (state.active) {
            // 活动状态：根据实际音频数据生成波形

            // 计算负责的频段范围
            const isMiddleLine = Math.abs(lineIndex - NUM_LINES/2) < NUM_LINES*0.3;
            const freqRange = isMiddleLine ? bufferLength/4 : bufferLength/3; // 中间线条使用更窄的频段
            
            const binStart = Math.floor((lineIndex / NUM_LINES) * freqRange);
            const binEnd = Math.floor(((lineIndex + 1) / NUM_LINES) * freqRange);

            // 计算频段平均值
            let freqSum = 0
            for (let bin = binStart; bin < binEnd; bin++) freqSum += dataArray[bin]
            const freqAvg = freqSum / Math.max(1, binEnd - binStart)

            // 将频率数据转换为波形振幅
            const freqFactor = (freqAvg / 255) * amplitude

            // 生成复合波形（基础波形 + 高频细节）
            waveformValue = Math.sin(t * 10 + state.phase + angleOffset) * freqFactor
            waveformValue += Math.sin(t * 20 + state.phase * 1.5) * (freqFactor * 0.2)
          } else {
            // 非活动状态：生成待机动画波形
            waveformValue = Math.sin(t * 8 + state.phase + angleOffset) * amplitude * 0.25
            waveformValue += Math.sin(t * 16 + state.phase * 1.3) * amplitude * 0.05
          }

          // ===== 坐标计算 =====
          // X轴拉伸效果（产生旋转动态）
          const xStretch = 1 + Math.sin(state.rotationAngle + t * Math.PI * 2) * 0.03
          // 最终坐标计算（限制波形在画布宽度范围内）
          const x = centerX + (t * 2 - 1) * (canvas.width * 0.5) * xStretch // 扩大绘制范围到80%
          const y = centerY + waveformValue

          // 绘制路径
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }

        // 描边路径
        ctx.stroke()
      }
    }

    // 启动绘制循环
    drawWaveforms()
  }

  // ============= 资源清理 =============
  /**
   * 清理音频资源
   * 1. 停止动画帧
   * 2. 断开音频节点
   * 3. 关闭媒体流
   */
  const cleanupAudio = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (sourceRef.current) sourceRef.current.disconnect()
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
    }
    if (audioContext) audioContext.close()
  }

  // ============= 渲染输出 =============
  return (
    <div className="audio-visualizer">
      {error ? (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>重试</button>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="visualizer-canvas"></canvas>
          <div className={`status-indicator ${isListening ? 'active' : ''}`}>
            {isListening ? '正在聆听...' : '初始化中...'}
          </div>
        </>
      )}
    </div>
  )
}

export default AudioVisualizer
