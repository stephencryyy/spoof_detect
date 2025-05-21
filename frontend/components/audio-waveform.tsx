"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import WaveSurfer from "wavesurfer.js"
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { Play, Pause } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AnalysisResultItem } from "../lib/types";

interface AudioWaveformProps {
  audioUrl: string | null;
  analysisData: AnalysisResultItem[] | null;
  playerKey?: string; // Optional, defaults to "waveform"
  activePlayerKey: string | null;
  onPlayRequest: (playerKey: string | null) => void;
  onEnded: (playerKey: string) => void;
  onProgressUpdate?: (playerKey: string, currentTime: number, duration: number) => void;
}

interface WaveformSectionData {
  id: string;
  start: number;
  end: number;
  score: number;
  color?: string;
}

export function AudioWaveform({
  audioUrl,
  analysisData,
  playerKey = "waveform", // Default playerKey
  activePlayerKey,
  onPlayRequest,
  onEnded,
  onProgressUpdate
}: AudioWaveformProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [duration, setDuration] = useState(0)
  const gridLinesRef = useRef<HTMLDivElement>(null)
  const [isWaveformPlaying, setIsWaveformPlaying] = useState(false) // Internal state of wavesurfer
  const [currentTime, setCurrentTime] = useState(0)
  const [displayableSections, setDisplayableSections] = useState<WaveformSectionData[]>([])
  const regionsPluginRef = useRef<RegionsPlugin | null>(null)
  const rafIdRef = useRef<number | null>(null); // Ref for requestAnimationFrame ID

  useEffect(() => {
    if (!waveformRef.current || !audioUrl) {
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy()
        wavesurferRef.current = null
      }
      setDuration(0)
      setCurrentTime(0)
      setIsWaveformPlaying(false)
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

    ws.on("play", () => setIsWaveformPlaying(true))
    ws.on("pause", () => setIsWaveformPlaying(false))
    ws.on("timeupdate", (time) => setCurrentTime(time))
    ws.on("finish", () => {
      setIsWaveformPlaying(false)
      if (onProgressUpdate) {
        const currentDuration = ws.getDuration() || 0;
      }
      onEnded(playerKey)
    })

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
      let color = 'rgba(0, 255, 0, 0.1)' // Green (default)
      if (probability >= 75) { // Red from 75%
        color = 'rgba(255, 0, 0, 0.2)'
      } else if (probability >= 50) { // Orange from 50%
        color = 'rgba(255, 165, 0, 0.2)' 
      } else if (probability >= 25) { // Yellow from 25%
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
    if (duration <= 0 || !gridLinesRef.current) return;
    gridLinesRef.current.innerHTML = "";

    const drawLineAtTime = (timeValue: number, isEndOfAudioOrSection: boolean = false) => {
      const position = (timeValue / duration) * 100;
      // Линии для интервалов рисуем, если position < 100.
      // Линию на самом конце аудио или секции рисуем, если position <= 100.
      if (timeValue > 0 && (position < 100 || (isEndOfAudioOrSection && position <= 100))) {
        const line = document.createElement("div");
        line.className = "absolute top-0 h-full w-[1px] bg-purple-300 bg-opacity-40";
        line.style.left = `${position}%`;
        gridLinesRef.current!.appendChild(line);
      }
    };

    if (displayableSections.length > 0) {
      // Рисуем линии на основе реальных секций анализа
      displayableSections.forEach(section => {
        if (section.start > 0) { // Не рисуем линию в самом начале (0s)
          drawLineAtTime(section.start);
        }
      });
      const lastSection = displayableSections[displayableSections.length - 1];
      // Убеждаемся, что конец последней секции отрисован, даже если он совпадает с длительностью аудио
      drawLineAtTime(lastSection.end, true);
    } else {
      // Рисуем линии по умолчанию с интервалом в 4 секунды
      for (let i = 1; (i * 4) < duration; i++) {
        drawLineAtTime(i * 4);
      }
      // Всегда рисуем линию на самом конце аудио, если нет секций анализа
      drawLineAtTime(duration, true);
    }
  }, [duration, displayableSections]);

  // Animation loop for progress updates
  const animationLoop = useCallback(() => {
    if (!wavesurferRef.current || !onProgressUpdate || activePlayerKey !== playerKey || !wavesurferRef.current.isPlaying()) {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null; // Ensure it's nulled if loop stops
      return;
    }
    const currentWsTime = wavesurferRef.current.getCurrentTime();
    const currentWsDuration = wavesurferRef.current.getDuration();
    onProgressUpdate(playerKey, currentWsTime, currentWsDuration);
    setCurrentTime(currentWsTime); // Keep internal current time updated

    rafIdRef.current = requestAnimationFrame(animationLoop);
  }, [playerKey, activePlayerKey, onProgressUpdate, wavesurferRef]);

  // Effect to control WaveSurfer play/pause based on activePlayerKey
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    if (activePlayerKey === playerKey) {
      if (!ws.isPlaying()) {
        ws.play();
        // RAF will be started by the "play" event listener if not already running
      }
    } else {
      if (ws.isPlaying()) {
        ws.pause();
      }
      // Stop RAF if this player is no longer active (pause will also stop it via event listener)
      // if (rafIdRef.current) {
      //   cancelAnimationFrame(rafIdRef.current);
      //   rafIdRef.current = null;
      // }
    }
    // No specific cleanup here for RAF as play/pause event handlers will manage it.
  }, [activePlayerKey, playerKey, wavesurferRef]);

  // Effect for WaveSurfer event listeners
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    const handlePlay = () => {
        setIsWaveformPlaying(true);
        if (activePlayerKey === playerKey) { // Only start RAF if this is the active player
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current); // Clear any old one
            rafIdRef.current = requestAnimationFrame(animationLoop);
        }
    };
    const handlePause = () => {
        setIsWaveformPlaying(false);
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    };
    const handleFinish = () => {
      setIsWaveformPlaying(false);
      if (rafIdRef.current) { // Stop RAF on finish
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (onProgressUpdate) {
        const currentDuration = ws.getDuration() || 0;
      }
      onEnded(playerKey);
    };
    const handleTimeUpdate = (time: number) => { // This can be simplified or removed if RAF is sole source of truth for parent
      setCurrentTime(time); // Keep internal state updated
      // onProgressUpdate is now primarily called by animationLoop
      // if (activePlayerKey === playerKey && onProgressUpdate) {
      //   const currentDuration = wavesurferRef.current?.getDuration() || 0;
      //   onProgressUpdate(playerKey, time, currentDuration);
      // }
    };

    ws.on("play", handlePlay);
    ws.on("pause", handlePause);
    ws.on("finish", handleFinish);
    ws.on("timeupdate", handleTimeUpdate);
    // Ready event is in the audioUrl useEffect

    return () => {
      // WaveSurfer instance might be destroyed, or we might unbind specific events
      // If ws.destroy() is called elsewhere, it typically unbinds its own events.
      // For safety, if ws instance still exists and has `un` method:
      if (ws && typeof ws.un === 'function') {
        ws.un("play", handlePlay);
        ws.un("pause", handlePause);
        ws.un("finish", handleFinish);
        ws.un("timeupdate", handleTimeUpdate);
      }
    };
  }, [wavesurferRef, playerKey, onEnded, activePlayerKey, onProgressUpdate]); // Dependencies for listeners

  const handleTogglePlayPause = () => {
    if (!wavesurferRef.current) return;
    if (activePlayerKey === playerKey) {
      onPlayRequest(null); // Request to deactivate (pause)
    } else {
      onPlayRequest(playerKey); // Request to activate (play)
    }
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
          onClick={handleTogglePlayPause}
          disabled={!audioUrl || duration === 0}
        >
          {activePlayerKey === playerKey ? <Pause size={16} /> : <Play size={16} />}
          <span>{activePlayerKey === playerKey ? "Пауза" : "Воспроизвести"}</span>
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
                  if (!isWaveformPlaying) {
                  }
                }
              }

              // Ограничиваем конец сегмента длительностью аудио
              const end = Math.min(section.end, duration);

              return (
                <div
                  key={section.id}
                  className={`absolute top-0 h-full group cursor-pointer z-10 ${hoverBgClass}`}
                  style={{
                    left: `${(section.start / duration) * 100}%`,
                    width: `${((end - section.start) / duration) * 100}%`,
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
                      {formatTime(section.start)} - {formatTime(end)}
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
