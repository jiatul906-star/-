import { useRef, useEffect, useCallback } from 'react'

interface Props {
  videoPath: string
  chromaKey?: string
  tolerance?: number
  cropX?: number
  cropY?: number
  cropW?: number
  cropH?: number
  trimStart?: number
  trimEnd?: number
  /** If true, use WebGL to preserve native alpha channel (for VP9 Alpha WebM) */
  useAlpha?: boolean
  /** fill mode: 'contain' (default) or 'cover' */
  fillMode?: 'contain' | 'cover'
  onEnded: () => void
  onError: () => void
  className?: string
  style?: React.CSSProperties
}

function parseColor(color: string): [number, number, number] {
  const s = color.trim().toLowerCase()
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
    if (hex.length === 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
    return [0, 255, 0]
  }
  const rm = s.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  if (rm) return [parseInt(rm[1]), parseInt(rm[2]), parseInt(rm[3])]
  const ram = s.match(/^rgba\((\d+),\s*(\d+),\s*(\d+)/)
  if (ram) return [parseInt(ram[1]), parseInt(ram[2]), parseInt(ram[3])]
  return [0, 255, 0]
}

// WebGL shader sources
const VERTEX_SHADER_SRC = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  uniform vec2 u_resolution;
  uniform vec2 u_drawOffset;
  uniform vec2 u_drawSize;
  void main() {
    // Convert from pixel coords to clip space
    // gl_Position.y = -y flips the Y axis because WebGL has Y=0 at bottom but screen has Y=0 at top
    float x = (a_position.x * u_drawSize.x + u_drawOffset.x) / u_resolution.x * 2.0 - 1.0;
    float y = (a_position.y * u_drawSize.y + u_drawOffset.y) / u_resolution.y * 2.0 - 1.0;
    gl_Position = vec4(x, -y, 0, 1);
    v_texCoord = a_texCoord;
  }
`

// Alpha-only shader (just renders video with native alpha)
const ALPHA_FRAGMENT_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    // For pre-multiplied alpha (standard for WebM VP9 alpha)
    // We un-premultiply for correct display
    if (color.a > 0.0) {
      gl_FragColor = vec4(color.rgb / color.a, color.a);
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
  }
`

// Chroma key shader (removes specified color)
const CHROMA_FRAGMENT_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  uniform vec3 u_keyColor;
  uniform float u_tolerance;
  void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    vec3 diff = color.rgb - u_keyColor;
    float dist = length(diff);
    float alpha = color.a;
    if (dist <= u_tolerance) {
      alpha = 0.0;
    }
    gl_FragColor = vec4(color.rgb, alpha);
  }
`

// Alpha + chroma key combined (for alpha videos that still need chroma keying)
const COMBINED_FRAGMENT_SRC = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_texture;
  uniform vec3 u_keyColor;
  uniform float u_tolerance;
  void main() {
    vec4 color = texture2D(u_texture, v_texCoord);
    // Un-premultiply alpha
    if (color.a > 0.0) {
      color.rgb /= color.a;
    }
    // Apply chroma key on top
    vec3 diff = color.rgb - u_keyColor;
    float dist = length(diff);
    if (dist <= u_tolerance) {
      color.a = 0.0;
    }
    gl_FragColor = color;
  }
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext, vertexSrc: string, fragmentSrc: string): WebGLProgram | null {
  const vShader = compileShader(gl, gl.VERTEX_SHADER, vertexSrc)
  const fShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc)
  if (!vShader || !fShader) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vShader)
  gl.attachShader(program, fShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

export default function ChromaKeyVideo({
  videoPath, chromaKey, tolerance = 100, cropX, cropY, cropW, cropH,
  trimStart, trimEnd, useAlpha = false, fillMode = 'contain', onEnded, onError, className, style,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const mountedRef = useRef(true)
  const hasChroma = typeof chromaKey === 'string' && chromaKey.length > 0
  const hasCrop = cropX != null || cropY != null || cropW != null || cropH != null

  // Determine rendering mode
  // useAlpha=true + chromaKey → COMBINED (alpha video with chroma fallback)
  // useAlpha=true + no chromaKey → ALPHA (native alpha only)
  // useAlpha=false + chromaKey → CHROMA (classic chroma key)
  // none → fallback to Canvas 2D (basic draw)
  const useWebGL = useAlpha || hasChroma

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Initialize WebGL context
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !useWebGL) return

    // Try to get WebGL context
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
    }) || canvas.getContext('experimental-webgl', {
      premultipliedAlpha: false,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
    })

    if (!gl) {
      console.warn('[ChromaKeyVideo] WebGL not available, falling back to Canvas 2D')
      return
    }

    glRef.current = gl

    // Select fragment shader based on mode
    let fragmentSrc: string
    if (useAlpha && hasChroma) {
      fragmentSrc = COMBINED_FRAGMENT_SRC
    } else if (useAlpha) {
      fragmentSrc = ALPHA_FRAGMENT_SRC
    } else {
      fragmentSrc = CHROMA_FRAGMENT_SRC
    }

    const program = createProgram(gl, VERTEX_SHADER_SRC, fragmentSrc)
    if (!program) {
      console.warn('[ChromaKeyVideo] Failed to create WebGL program')
      return
    }
    programRef.current = program

    // Set up geometry (a single quad covering unit square)
    const positions = new Float32Array([
      0, 0,  1, 0,  0, 1,   // triangle 1
      0, 1,  1, 0,  1, 1,   // triangle 2
    ])
    const texCoords = new Float32Array([
      0, 1,  1, 1,  0, 0,
      0, 0,  1, 1,  1, 0,
    ])

    const posBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const texBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)

    // Cleanup
    return () => {
      cancelAnimationFrame(animRef.current)
      if (glRef.current) {
        const gl2 = glRef.current
        gl2.deleteBuffer(posBuffer)
        gl2.deleteBuffer(texBuffer)
        if (programRef.current) {
          gl2.deleteProgram(programRef.current)
          programRef.current = null
        }
        glRef.current = null
      }
    }
  }, [useAlpha, hasChroma, useWebGL, videoPath]) // re-init on video change

  const renderFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.paused || video.ended) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    if (vw === 0 || vh === 0) {
      animRef.current = requestAnimationFrame(renderFrame)
      return
    }

    // Calculate crop source coords (percentage → pixel)
    const sx = ((cropX ?? 0) / 100) * vw
    const sy = ((cropY ?? 0) / 100) * vh
    const sw = ((cropW ?? 100) / 100) * vw
    const sh = ((cropH ?? 100) / 100) * vh

    // Match canvas internal resolution to CSS display size
    const displayW = canvas.clientWidth
    const displayH = canvas.clientHeight
    const dpr = window.devicePixelRatio || 1

    if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
      canvas.width = displayW * dpr
      canvas.height = displayH * dpr
    }

    // Calculate draw rect based on fillMode
    const cropAspect = sw / sh
    const canvasAspect = displayW / displayH

    let drawW: number, drawH: number, drawX: number, drawY: number
    if (fillMode === 'cover') {
      // cover: fill the canvas, cropping excess
      if (cropAspect > canvasAspect) {
        drawH = displayH
        drawW = displayH * cropAspect
        drawX = (displayW - drawW) / 2
        drawY = 0
      } else {
        drawW = displayW
        drawH = displayW / cropAspect
        drawX = 0
        drawY = (displayH - drawH) / 2
      }
    } else {
      // contain: fit within canvas, letterbox if needed
      if (cropAspect > canvasAspect) {
        drawW = displayW
        drawH = displayW / cropAspect
        drawX = 0
        drawY = (displayH - drawH) / 2
      } else {
        drawH = displayH
        drawW = displayH * cropAspect
        drawX = (displayW - drawW) / 2
        drawY = 0
      }
    }

    const gl = glRef.current
    const program = programRef.current

    if (gl && program) {
      // === WebGL path ===
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.useProgram(program)

      // Set up texture
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)

      // CRITICAL: UNPACK_PREMULTIPLY_ALPHA_WEBGL = false
      // This preserves the native alpha channel from the video
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

      // Upload the video frame (only the cropped region — BUT WebGL needs full frame,
      // we handle cropping via texture coords)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

      // Set uniforms
      const resolutionLoc = gl.getUniformLocation(program, 'u_resolution')
      const drawOffsetLoc = gl.getUniformLocation(program, 'u_drawOffset')
      const drawSizeLoc = gl.getUniformLocation(program, 'u_drawSize')

      gl.uniform2f(resolutionLoc, canvas.width / dpr, canvas.height / dpr)
      gl.uniform2f(drawOffsetLoc, drawX, drawY)
      gl.uniform2f(drawSizeLoc, drawW, drawH)

      // Set chroma key uniforms if applicable
      if (hasChroma) {
        const keyColorLoc = gl.getUniformLocation(program, 'u_keyColor')
        const toleranceLoc = gl.getUniformLocation(program, 'u_tolerance')
        if (keyColorLoc) {
          const [kr, kg, kb] = parseColor(chromaKey!)
          gl.uniform3f(keyColorLoc, kr / 255, kg / 255, kb / 255)
        }
        if (toleranceLoc) {
          gl.uniform1f(toleranceLoc, (tolerance ?? 100) / 255)
        }
      }

      // Set up attributes
      const posLoc = gl.getAttribLocation(program, 'a_position')
      const texLoc = gl.getAttribLocation(program, 'a_texCoord')

      // Re-bind position buffer
      const posBuffer = gl.createBuffer()
      const positions = new Float32Array([
        0, 0,  1, 0,  0, 1,
        0, 1,  1, 0,  1, 1,
      ])
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

      // Re-bind texCoord buffer (adjusted for crop region)
      const texBuffer = gl.createBuffer()
      const tx1 = sx / vw
      const ty1 = sy / vh
      const tx2 = (sx + sw) / vw
      const ty2 = (sy + sh) / vh

      // texCoords: swap ty1/ty2 to match raw <video> orientation
      // (vertex shader gl_Position.y = -y already flips the Y axis)
      const texCoords = new Float32Array([
        tx1, ty2,  tx2, ty2,  tx1, ty1,
        tx1, ty1,  tx2, ty2,  tx2, ty1,
      ])
      gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(texLoc)
      gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      // Cleanup this frame's buffers
      gl.deleteBuffer(posBuffer)
      gl.deleteBuffer(texBuffer)
      gl.deleteTexture(texture)
    } else {
      // === Canvas 2D fallback ===
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpx = drawX * dpr
      const dpy = drawY * dpr
      const dpw = drawW * dpr
      const dph = drawH * dpr

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(video, sx, sy, sw, sh, dpx, dpy, dpw, dph)

      if (hasChroma) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const keyColor = parseColor(chromaKey!)
        const [kr, kg, kb] = keyColor
        const t = (tolerance ?? 100) / 255.0
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const dr = (r - kr) / 255, dg = (g - kg) / 255, db = (b - kb) / 255
          if (Math.sqrt(dr * dr + dg * dg + db * db) <= t) data[i + 3] = 0
        }
        ctx.putImageData(imageData, 0, 0)
      }
    }

    animRef.current = requestAnimationFrame(renderFrame)
  }, [cropX, cropY, cropW, cropH, hasChroma, useAlpha, chromaKey, tolerance, fillMode])

  // Video lifecycle
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const src = 'file:///' + videoPath.replace(/\\/g, '/')
    video.src = src
    video.load()

    const onLoad = () => {
      if (trimStart != null) video.currentTime = trimStart
      video.play().catch(() => onError())
      animRef.current = requestAnimationFrame(renderFrame)
    }

    const onTimeUpdate = () => {
      if (trimEnd != null && video.currentTime >= trimEnd) {
        video.pause()
        onEnded()
      }
    }

    const onVideoEnd = () => onEnded()
    const onVideoError = () => { if (mountedRef.current) onError() }

    video.addEventListener('loadedmetadata', onLoad)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onVideoEnd)
    video.addEventListener('error', onVideoError)

    return () => {
      video.removeEventListener('loadedmetadata', onLoad)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onVideoEnd)
      video.removeEventListener('error', onVideoError)
      cancelAnimationFrame(animRef.current)
      video.pause()
      video.src = ''
    }
  }, [videoPath, trimStart, trimEnd, renderFrame, onEnded, onError])

  return (
    <>
      <video ref={videoRef} style={{ display: 'none' }} muted playsInline crossOrigin="anonymous" />
      <canvas ref={canvasRef} className={className} style={{ ...style, width: style?.width || '100%', height: style?.height || '100%' }} />
    </>
  )
}
