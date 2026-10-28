import { useEffect, useRef, useState } from 'react'

/** Browser-native voice: SpeechRecognition (STT) + speechSynthesis (TTS).
 * Works offline in Chrome/Edge; honest about availability. */
export default function VoiceControls({
  onTranscript, speakReplies, onToggleSpeak,
}: {
  onTranscript: (t: string) => void
  speakReplies: boolean
  onToggleSpeak: (v: boolean) => void
}) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const recRef = useRef<any>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SR)
    if (!SR) return
    const rec = new SR()
    rec.lang = 'es-MX'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join(' ')
      onTranscript(t)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
  }, [])

  if (!supported) {
    return (
      <span className="text-xs text-slate-500 px-2" title="Tu navegador no soporta reconocimiento de voz (usa Chrome/Edge)">
        🎤 no disponible
      </span>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <button
        className={`btn-ghost ${listening ? 'text-warn animate-pulse' : ''}`}
        title={listening ? 'Escuchando… (clic para parar)' : 'Dictar por voz'}
        onClick={() => {
          if (listening) { recRef.current?.stop(); setListening(false) }
          else { speechSynthesis.cancel(); recRef.current?.start(); setListening(true) }
        }}>
        {listening ? '⏺' : '🎤'}
      </button>
      <button
        className={`btn-ghost ${speakReplies ? 'text-accent' : 'text-slate-500'}`}
        title="Respuestas habladas"
        onClick={() => {
          if (speakReplies) speechSynthesis.cancel()
          onToggleSpeak(!speakReplies)
        }}>
        {speakReplies ? '🔊' : '🔇'}
      </button>
    </div>
  )
}
