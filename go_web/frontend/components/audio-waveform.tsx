"use client"

import { useEffect, useRef, useState } from "react"
import WaveSurfer from "wavesurfer.js"
import { Play, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"

interface AudioWaveformProps {
  audioFile: File
  onSectionsAnalyzed?: (sections: SuspiciousSection[]) => void
}

export interface SuspiciousSection {
  sectionNumber: number
  startTime: number
  endTime: number
  probability: number
}

export function AudioWaveform({ audioFile, onSectionsAnalyzed }: AudioWaveformProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [duration, setDuration] = useState(0)
  const gridLinesRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [sectionsData, setSectionsData] = useState<SuspiciousSection[]>([])

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current) return

    // Clean up previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy()
    }

    // Create new WaveSurfer instance
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#c4b5fd", // Light purple
      progressColor: "#6a50d3", // Darker purple
      cursorColor: "#6a50d3", // Show cursor for playback
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      responsive: true,
      interact: true, // Enable user interaction for playback
    })

    // Load audio file
    const audioUrl = URL.createObjectURL(audioFile)
    wavesurfer.load(audioUrl)

    // Get duration and create grid lines
    wavesurfer.on("ready", () => {
      const audioDuration = wavesurfer.getDuration()
      setDuration(audioDuration)

      // Generate section data with realistic probabilities
      generateSectionData(audioDuration)
    })

    // Add playback event listeners
    wavesurfer.on("play", () => setIsPlaying(true))
    wavesurfer.on("pause", () => setIsPlaying(false))
    wavesurfer.on("timeupdate", (time) => setCurrentTime(time))

    // Save reference
    wavesurferRef.current = wavesurfer

    // Cleanup
    return () => {
      URL.revokeObjectURL(audioUrl)
      wavesurfer.destroy()
    }
  }, [audioFile])

  // Generate section data with realistic probabilities
  const generateSectionData = (audioDuration: number) => {
    const sectionCount = Math.ceil(audioDuration / 4)
    const sections: SuspiciousSection[] = []

    for (let i = 1; i <= sectionCount; i++) {
      // Generate realistic probabilities
      // Section 3 should have low probability (2%)
      // Sections 5 and 11 should have high probabilities
      let probability = Math.floor(Math.random() * 30) // Most sections have low probability

      if (i === 3) {
        probability = 2 // Section 3 has 2% as mentioned by user
      } else if (i === 5) {
        probability = 78 // High probability for section 5
      } else if (i === 11 && sectionCount >= 11) {
        probability = 92 // High probability for section 11
      }

      sections.push({
        sectionNumber: i,
        startTime: (i - 1) * 4,
        endTime: i * 4 > audioDuration ? audioDuration : i * 4,
        probability,
      })
    }

    setSectionsData(sections)

    // Find suspicious sections (probability > 70%)
    const suspiciousSections = sections.filter((section) => section.probability > 70)

    // Notify parent component about suspicious sections
    if (onSectionsAnalyzed) {
      onSectionsAnalyzed(suspiciousSections)
    }
  }

  // Create grid lines when duration changes
  useEffect(() => {
    if (duration <= 0 || !gridLinesRef.current) return

    // Clear previous grid lines
    gridLinesRef.current.innerHTML = ""

    // Calculate number of grid lines (every 4 seconds)
    const numberOfLines = Math.floor(duration / 4)

    // Create grid lines
    for (let i = 1; i <= numberOfLines; i++) {
      const position = ((i * 4) / duration) * 100

      const line = document.createElement("div")
      line.className = "absolute top-0 h-full w-[1px] bg-[#6a50d3] bg-opacity-20"
      line.style.left = `${position}%`

      gridLinesRef.current.appendChild(line)
    }
  }, [duration])

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!wavesurferRef.current) return
    wavesurferRef.current.playPause()
  }

  // Format time (seconds to MM:SS)
  const formatTime = (time: number) => {
    if (!isFinite(time)) return "00:00"

    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="w-full max-w-[95%] mx-auto bg-gray-50 p-4 rounded-lg border border-gray-100">
      {/* Playback controls */}
      <div className="flex items-center justify-between mb-2">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1 text-[#6a50d3]"
          onClick={togglePlayPause}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          <span>{isPlaying ? "Пауза" : "Воспроизвести"}</span>
        </Button>

        <div className="text-sm text-gray-500">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Waveform container with grid lines overlay */}
      <div className="relative w-full">
        <div ref={waveformRef} className="w-full rounded-md overflow-hidden" />
        <div ref={gridLinesRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

        {/* Hover chunks overlay */}
        {duration > 0 && (
          <div className="absolute top-0 left-0 w-full h-full">
            {sectionsData.map((section) => {
              const getConfidenceLevel = (value: number) => {
                if (value < 30) return "Вероятно подлинный"
                if (value < 70) return "Возможно ИИ"
                return "Вероятно ИИ"
              }

              // Determine background color based on probability
              const getBgColorClass = (value: number) => {
                if (value > 70) return "hover:bg-red-500"
                if (value > 30) return "hover:bg-yellow-500"
                return "hover:bg-green-500"
              }

              // Handle click on section to seek to its start time
              const handleSectionClick = () => {
                if (wavesurferRef.current) {
                  wavesurferRef.current.seekTo(section.startTime / duration)
                  // Optionally start playing from this position
                  if (!isPlaying) {
                    wavesurferRef.current.play()
                  }
                }
              }

              return (
                <div
                  key={section.sectionNumber}
                  className={`absolute top-0 h-full group cursor-pointer z-10`}
                  style={{
                    left: `${(section.startTime / duration) * 100}%`,
                    width: `${((section.endTime - section.startTime) / duration) * 100}%`,
                    maxWidth: "100%",
                  }}
                  onClick={handleSectionClick}
                >
                  <div className="hidden group-hover:block absolute bottom-full mb-2 bg-white p-2 rounded shadow-lg z-20 text-sm">
                    <div className="font-medium">Секция {section.sectionNumber}</div>
                    <div
                      className={`${
                        section.probability < 30
                          ? "text-green-600"
                          : section.probability < 70
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {getConfidenceLevel(section.probability)}: {section.probability}%
                    </div>
                  </div>
                  <div
                    className={`w-full h-full opacity-0 ${getBgColorClass(section.probability)} hover:opacity-20 transition-opacity`}
                  ></div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
