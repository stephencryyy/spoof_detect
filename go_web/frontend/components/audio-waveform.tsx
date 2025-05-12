"use client"

import { useEffect, useRef, useState } from "react"
import WaveSurfer from "wavesurfer.js"
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { Play, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AnalysisResultItem } from "../lib/types";

interface AudioWaveformProps {
  audioUrl: string | null;
  analysisData: AnalysisResultItem[] | null;
}

interface WaveformSectionData {
  id: string;
  start: number;
  end: number;
  score: number;
  color?: string;
}

export function AudioWaveform({ audioUrl, analysisData }: AudioWaveformProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [duration, setDuration] = useState(0)
  const gridLinesRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [displayableSections, setDisplayableSections] = useState<WaveformSectionData[]>([])
  const regionsPluginRef = useRef<RegionsPlugin | null>(null)

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
      setDuration(0)
      setCurrentTime(0)
      setIsPlaying(false)
      setDisplayableSections([])
      if (gridLinesRef.current) gridLinesRef.current.innerHTML = ""
      return
    }

    if (wavesurferRef.current) {
      wavesurferRef.current.load(audioUrl)
    } else {
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#c4b5fd",
        progressColor: "#6a50d3",
        cursorColor: "#6a50d3",
        height: 80,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        interact: true,
      })
      wavesurferRef.current = wavesurfer
      wavesurfer.load(audioUrl)
    }
    
    const ws = wavesurferRef.current

    ws.on("ready", () => {
      const audioDuration = ws.getDuration()
      setDuration(audioDuration)
    })

    ws.on("play", () => setIsPlaying(true))
    ws.on("pause", () => setIsPlaying(false))
    ws.on("timeupdate", (time) => setCurrentTime(time))
    ws.on("finish", () => setIsPlaying(false))

    return () => {
    }
  }, [audioUrl])

  useEffect(() => {
    const ws = wavesurferRef.current
    if (!ws || !analysisData || duration === 0) {
      setDisplayableSections([])
      if (regionsPluginRef.current) {
        regionsPluginRef.current.clearRegions()
      }
      return
    }

    if (!regionsPluginRef.current) {
        regionsPluginRef.current = ws.registerPlugin(RegionsPlugin.create())
    }
    const regions = regionsPluginRef.current
    regions.clearRegions()

    const newDisplayableSections: WaveformSectionData[] = analysisData.map(item => {
      const probability = item.score * 100
      let color = 'rgba(0, 255, 0, 0.1)'
      if (probability > 70) {
        color = 'rgba(255, 0, 0, 0.2)'
      } else if (probability > 40) {
        color = 'rgba(255, 255, 0, 0.2)'
      }

      regions.addRegion({
        id: item.chunk_id,
        start: item.start_time_seconds,
        end: item.end_time_seconds,
        color: color,
        drag: false,
        resize: false,
      })

      return {
        id: item.chunk_id,
        start: item.start_time_seconds,
        end: item.end_time_seconds,
        score: item.score,
        color: color,
      }
    })
    setDisplayableSections(newDisplayableSections)

  }, [analysisData, duration])

  useEffect(() => {
    if (duration <= 0 || !gridLinesRef.current) return
    gridLinesRef.current.innerHTML = ""
    const numberOfSegments = displayableSections.length > 0 ? displayableSections.length : Math.floor(duration / 4) || 1

    for (let i = 0; i < numberOfSegments; i++) {
        const section = displayableSections[i]
        const lineStart = section ? section.start : i * 4
        if (lineStart > 0) {
            const position = (lineStart / duration) * 100
            if (position < 100) {
                 const line = document.createElement("div")
                 line.className = "absolute top-0 h-full w-[1px] bg-purple-300 bg-opacity-40"
                 line.style.left = `${position}%`
                 gridLinesRef.current.appendChild(line)
            }
        }
    }
     if (displayableSections.length > 0) {
        const lastSection = displayableSections[displayableSections.length - 1]
        const lastPosition = (lastSection.end / duration) * 100
        if (lastPosition <= 100) {
            const line = document.createElement("div")
            line.className = "absolute top-0 h-full w-[1px] bg-purple-300 bg-opacity-40"
            line.style.left = `${lastPosition}%`
            gridLinesRef.current.appendChild(line)
        }
    }

  }, [duration, displayableSections])

  const togglePlayPause = () => {
    if (!wavesurferRef.current) return
    wavesurferRef.current.playPause()
  }

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return "00:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const formatScoreAsPercentage = (score: number) => {
    return (score * 100).toFixed(1)
  }

  return (
    <div className="w-full max-w-[95%] mx-auto bg-gray-50 p-4 rounded-lg border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1 text-purple-600 hover:text-purple-700 border-purple-300 hover:bg-purple-50"
          onClick={togglePlayPause}
          disabled={!audioUrl || duration === 0}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          <span>{isPlaying ? "Пауза" : "Воспроизвести"}</span>
        </Button>
        <div className="text-sm text-gray-500">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <div className="relative w-full">
        <div ref={waveformRef} className={`w-full rounded-md overflow-hidden ${!audioUrl ? 'bg-gray-200 min-h-[80px]' : ''}`} />
        <div ref={gridLinesRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

        {audioUrl && duration > 0 && analysisData && (
          <div className="absolute top-0 left-0 w-full h-full">
            {displayableSections.map((section, index) => {
              const probability = section.score * 100
              let textColorClass = "text-green-700"
              let hoverBgClass = "hover:bg-green-500/20"

              if (probability > 70) {
                textColorClass = "text-red-700"
                hoverBgClass = "hover:bg-red-500/20"
              } else if (probability > 40) {
                textColorClass = "text-yellow-700"
                hoverBgClass = "hover:bg-yellow-500/20"
              }

              const handleSectionClick = () => {
                if (wavesurferRef.current) {
                  wavesurferRef.current.seekTo(section.start / duration)
                  if (!isPlaying) {
                  }
                }
              }

              return (
                <div
                  key={section.id}
                  className={`absolute top-0 h-full group cursor-pointer z-10 ${hoverBgClass}`}
                  style={{
                    left: `${(section.start / duration) * 100}%`,
                    width: `${((section.end - section.start) / duration) * 100}%`,
                    maxWidth: "100%",
                  }}
                  onClick={handleSectionClick}
                  title={`Сегмент ${index + 1}: ${formatScoreAsPercentage(section.score)}%`}
                >
                  <div className="hidden group-hover:flex absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-xs bg-gray-800 text-white p-2 rounded shadow-lg z-20 text-xs flex-col items-center">
                    <div className="font-semibold">Сегмент {index + 1}</div>
                    <div className={textColorClass}>
                       Оценка: {formatScoreAsPercentage(section.score)}%
                    </div>
                    <div className="text-gray-300">
                      {formatTime(section.start)} - {formatTime(section.end)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
