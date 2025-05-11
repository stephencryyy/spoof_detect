"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"

interface AudioPlayerProps {
  audioUrl: string
  startTime?: number
  endTime?: number
  sectionName?: string
  compact?: boolean
  hideVolumeControl?: boolean
}

export function AudioPlayer({
  audioUrl,
  startTime,
  endTime,
  sectionName,
  compact = false,
  hideVolumeControl = false,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(audioUrl)
    audioRef.current = audio

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration)
    })

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime)

      // If playing a section and reached the end time, pause
      if (endTime && audio.currentTime >= endTime) {
        audio.pause()
        setIsPlaying(false)
      }
    })

    audio.addEventListener("ended", () => {
      setIsPlaying(false)
      setCurrentTime(0)
    })

    return () => {
      audio.pause()
      audio.src = ""
    }
  }, [audioUrl, endTime])

  const togglePlay = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      // If playing a section, start from the specified time
      if (startTime !== undefined) {
        audioRef.current.currentTime = startTime
      }
      audioRef.current.play()
    }

    setIsPlaying(!isPlaying)
  }

  const handleSeek = (newPosition: number[]) => {
    if (!audioRef.current) return

    const seekTime = newPosition[0]
    audioRef.current.currentTime = seekTime
    setCurrentTime(seekTime)
  }

  // Format time (seconds to MM:SS)
  const formatTime = (time: number) => {
    if (!isFinite(time)) return "00:00"

    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // For compact mode, just show a play button
  if (compact) {
    return (
      <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-700" onClick={togglePlay}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </Button>
    )
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      {sectionName && <div className="mb-2 font-medium text-gray-700">{sectionName}</div>}

      <div className="flex items-center space-x-2">
        <Button variant="outline" size="icon" className="h-10 w-10 text-[#6a50d3]" onClick={togglePlay}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </Button>

        <div className="flex-1 mx-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
