import { GeminiLiveAPI } from "./geminilive"

export class AudioStreamer {
  private client: GeminiLiveAPI
  private audioContext: AudioContext | null = null
  private audioWorklet: AudioWorkletNode | null = null
  private mediaStream: MediaStream | null = null
  isStreaming = false
  private sampleRate = 16000

  constructor(client: GeminiLiveAPI) {
    this.client = client
  }

  async start(deviceId?: string) {
    const audioConstraints: MediaTrackConstraints = {
      sampleRate: this.sampleRate,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    }
    if (deviceId) {
      audioConstraints.deviceId = { exact: deviceId }
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })

    this.audioContext = new AudioContext({ sampleRate: this.sampleRate })

    await this.audioContext.audioWorklet.addModule("/audio-processors/capture.worklet.js")

    this.audioWorklet = new AudioWorkletNode(this.audioContext, "audio-capture-processor")

    this.audioWorklet.port.onmessage = (event) => {
      if (!this.isStreaming) return
      if (event.data.type === "audio") {
        const pcmData = this.convertToPCM16(event.data.data)
        const base64Audio = this.arrayBufferToBase64(pcmData)
        if (this.client.connected) {
          this.client.sendAudioMessage(base64Audio)
        }
      }
    }

    const source = this.audioContext.createMediaStreamSource(this.mediaStream)
    source.connect(this.audioWorklet)
    this.isStreaming = true
  }

  stop() {
    this.isStreaming = false
    this.audioWorklet?.disconnect()
    this.audioWorklet?.port.close()
    this.audioWorklet = null
    this.audioContext?.close()
    this.audioContext = null
    this.mediaStream?.getTracks().forEach((t) => t.stop())
    this.mediaStream = null
  }

  private convertToPCM16(float32Array: Float32Array): ArrayBuffer {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      int16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7fff
    }
    return int16Array.buffer
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}

class BaseVideoCapture {
  protected client: GeminiLiveAPI
  protected video: HTMLVideoElement | null = null
  protected canvas: HTMLCanvasElement | null = null
  protected ctx: CanvasRenderingContext2D | null = null
  protected mediaStream: MediaStream | null = null
  isStreaming = false
  protected captureInterval: ReturnType<typeof setInterval> | null = null
  protected fps = 1
  protected quality = 0.8

  constructor(client: GeminiLiveAPI) {
    this.client = client
  }

  protected initializeElements(width: number, height: number) {
    this.video = document.createElement("video")
    this.video.srcObject = this.mediaStream
    this.video.autoplay = true
    this.video.playsInline = true
    this.video.muted = true

    this.canvas = document.createElement("canvas")
    this.canvas.width = width
    this.canvas.height = height
    this.ctx = this.canvas.getContext("2d")
  }

  protected async waitForVideoReady() {
    if (!this.video) return
    await new Promise<void>((resolve) => {
      this.video!.onloadedmetadata = () => resolve()
    })
    this.video!.play()
  }

  protected startCapturing() {
    const captureFrame = () => {
      if (!this.isStreaming || !this.ctx || !this.video || !this.canvas) return
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)
      this.canvas.toBlob((blob) => {
        if (!blob) return
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1]
          if (this.client.connected) {
            this.client.sendImageMessage(base64)
          }
        }
        reader.readAsDataURL(blob)
      }, "image/jpeg", this.quality)
    }
    this.captureInterval = setInterval(captureFrame, 1000 / this.fps)
  }

  stop() {
    this.isStreaming = false
    if (this.captureInterval) {
      clearInterval(this.captureInterval)
      this.captureInterval = null
    }
    this.mediaStream?.getTracks().forEach((t) => t.stop())
    this.mediaStream = null
    this.video = null
    this.canvas = null
    this.ctx = null
  }
}

export class VideoStreamer extends BaseVideoCapture {
  async start(options?: {
    fps?: number
    width?: number
    height?: number
    facingMode?: string
    quality?: number
    deviceId?: string
  }) {
    const { fps = 1, width = 640, height = 480, quality = 0.8, deviceId = null } = options || {}

    this.fps = fps
    this.quality = quality

    const videoConstraints: MediaTrackConstraints = { width: { ideal: width }, height: { ideal: height } }
    if (deviceId) {
      videoConstraints.deviceId = { exact: deviceId }
    } else {
      videoConstraints.facingMode = "user"
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints })
    this.initializeElements(width, height)
    await this.waitForVideoReady()
    this.isStreaming = true
    this.startCapturing()
    return this.video
  }
}

export class ScreenCapture extends BaseVideoCapture {
  async start(options?: { fps?: number; width?: number; height?: number; quality?: number }) {
    const { fps = 1, width = 1280, height = 720, quality = 0.7 } = options || {}

    this.fps = fps
    this.quality = quality

    this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: width }, height: { ideal: height } },
      audio: false,
    })

    this.initializeElements(width, height)
    await this.waitForVideoReady()
    this.isStreaming = true
    this.startCapturing()

    this.mediaStream.getVideoTracks()[0].onended = () => this.stop()

    return this.video
  }
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private gainNode: GainNode | null = null
  private isInitialized = false
  private volume = 1.0
  private sampleRate = 24000

  async init() {
    if (this.isInitialized) return

    this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
    await this.audioContext.audioWorklet.addModule("/audio-processors/playback.worklet.js")

    this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-processor")
    this.gainNode = this.audioContext.createGain()
    this.gainNode.gain.value = this.volume

    this.workletNode.connect(this.gainNode)
    this.gainNode.connect(this.audioContext.destination)
    this.isInitialized = true
  }

  async play(base64Audio: string) {
    if (!this.isInitialized) await this.init()
    if (this.audioContext?.state === "suspended") await this.audioContext.resume()

    const binaryString = atob(base64Audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const inputArray = new Int16Array(bytes.buffer)
    const float32Data = new Float32Array(inputArray.length)
    for (let i = 0; i < inputArray.length; i++) {
      float32Data[i] = inputArray[i] / 32768
    }

    this.workletNode?.port.postMessage(float32Data)
  }

  interrupt() {
    this.workletNode?.port.postMessage("interrupt")
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol))
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume
    }
  }

  destroy() {
    this.audioContext?.close()
    this.audioContext = null
    this.isInitialized = false
  }
}
