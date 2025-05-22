"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
  playerKey: string
  activePlayerKey: string | null
  onPlayRequest: (playerKey: string | null) => void
  onEnded: (playerKey: string) => void
  onProgressUpdate?: (playerKey: string, currentTime: number, duration: number) => void;
}

export function AudioPlayer({
  audioUrl,
  startTime,
  endTime,
  sectionName,
  compact = false,
  hideVolumeControl = false,
  playerKey,
  activePlayerKey,
  onPlayRequest,
  onEnded,
  onProgressUpdate,
}: AudioPlayerProps) {
  const [isElementPlaying, setIsElementPlaying] = useState(false) // Actual state of <audio> element
  const [currentTime, setCurrentTime] = useState(startTime ?? 0)
  const [duration, setDuration] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafIdRef = useRef<number | null>(null); // Ref for requestAnimationFrame ID

  useEffect(() => {
    const audio = new Audio(audioUrl)
    audioRef.current = audio
    setCurrentTime(startTime ?? 0) 
    console.log(`[AudioPlayer ${playerKey}] Initializing. audioUrl: ${audioUrl}, startTime: ${startTime}, endTime: ${endTime}`);

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      if (startTime !== undefined) {
        audio.currentTime = startTime;
        setCurrentTime(startTime);
      }
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)

    return () => {
      if (audioRef.current) { // Check if audioRef.current is not null
        audioRef.current.pause()
        audioRef.current.removeEventListener("loadedmetadata", handleLoadedMetadata)
        audioRef.current.src = "" 
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      // No need to set audioRef.current = null here as it's managed by the component lifecycle
    }
  }, [audioUrl, startTime])

  const animationLoop = useCallback(() => {
    if (!audioRef.current || !onProgressUpdate || activePlayerKey !== playerKey || audioRef.current.paused) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null; 
      }
      return;
    }
    const currentAudioTime = audioRef.current.currentTime;
    const currentDuration = audioRef.current.duration;
    onProgressUpdate(playerKey, currentAudioTime, currentDuration);
    setCurrentTime(currentAudioTime); 

    rafIdRef.current = requestAnimationFrame(animationLoop);
  }, [playerKey, activePlayerKey, onProgressUpdate]); // audioRef removed as it's a ref

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (activePlayerKey === playerKey) {
      if (audio.paused) {
        console.log(`[AudioPlayer ${playerKey}] Activating. activePlayerKey: ${activePlayerKey}, current audioTime: ${audio.currentTime}, props startTime: ${startTime}, props endTime: ${endTime}`);
        if (startTime !== undefined) {
          audio.currentTime = startTime;
        } else if (audio.ended) {
          audio.currentTime = 0;
        }
        
        setCurrentTime(audio.currentTime); // Sync state before play
        console.log(`[AudioPlayer ${playerKey}] Attempting to play. Setting currentTime to: ${audio.currentTime}`);

        audio.play()
          .then(() => {
            setIsElementPlaying(true);
            if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = requestAnimationFrame(animationLoop);
          })
          .catch(error => {
            console.error(`Error playing audio [${playerKey}]:`, error);
            setIsElementPlaying(false);
          });
      } else {
        // Already playing, ensure RAF is running and state is correct
        setIsElementPlaying(true);
        if (!rafIdRef.current) { // Ensure RAF is started if it somehow stopped
           if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
           rafIdRef.current = requestAnimationFrame(animationLoop);
        }
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
      setIsElementPlaying(false);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
    
    // No return cleanup for RAF here, as play/pause events will handle it via animationLoop's own check or activePlayerKey change.
  }, [activePlayerKey, playerKey, startTime, endTime, animationLoop]); // audioRef removed

  const handleTimeUpdateCallback = useCallback(() => {
    if (!audioRef.current) return;
    const currentAudioTime = audioRef.current.currentTime;
    setCurrentTime(currentAudioTime);

    if (onProgressUpdate && activePlayerKey === playerKey) { // Call onProgressUpdate if this player is active
        onProgressUpdate(playerKey, currentAudioTime, audioRef.current.duration);
    }

    // Добавляем допуск 0.15 сек для завершения сегмента (устраняет проблему с микрофоном)
    const epsilon = 0.15;
    if (endTime !== undefined && currentAudioTime >= endTime - epsilon) {
      if (audioRef.current) {
        audioRef.current.currentTime = endTime;
      }
      setCurrentTime(endTime);
      if (!audioRef.current?.paused) {
        audioRef.current.pause();
      }
      if (activePlayerKey === playerKey) {
        if (onProgressUpdate) {
          onProgressUpdate(playerKey, endTime, audioRef.current?.duration ?? endTime);
        }
        setIsElementPlaying(false);
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        onEnded(playerKey);
      }
      return;
    }
  }, [activePlayerKey, playerKey, endTime, onEnded, onProgressUpdate, startTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlayEvent = () => {
      setIsElementPlaying(true);
      // Start RAF via animationLoop if this player is active
      // This also ensures RAF starts if play is triggered externally (e.g. devtools)
      if (activePlayerKey === playerKey && !audio.paused) { // Check if still active and actually playing
         if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
         rafIdRef.current = requestAnimationFrame(animationLoop);
      }
    };
    const handlePauseEvent = () => {
      setIsElementPlaying(false);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
    const handleEndedEvent = () => {
      setIsElementPlaying(false);
      // For segments, onEnded is handled by timeupdate. This is for natural end of full track.
      if (endTime === undefined) { 
        setCurrentTime(startTime ?? 0); 
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        onEnded(playerKey);
      }
    };

    audio.addEventListener("play", handlePlayEvent);
    audio.addEventListener("pause", handlePauseEvent);
    audio.addEventListener("ended", handleEndedEvent);
    audio.addEventListener("timeupdate", handleTimeUpdateCallback);

    return () => {
      if (audioRef.current) { // Check if audioRef.current is not null before removing listeners
        audioRef.current.removeEventListener("play", handlePlayEvent);
        audioRef.current.removeEventListener("pause", handlePauseEvent);
        audioRef.current.removeEventListener("ended", handleEndedEvent);
        audioRef.current.removeEventListener("timeupdate", handleTimeUpdateCallback);
      }
    };
  }, [activePlayerKey, playerKey, animationLoop, handleTimeUpdateCallback, onEnded, endTime, startTime]); // audioRef removed

  const handleTogglePlay = () => {
    if (activePlayerKey === playerKey) {
      onPlayRequest(null) 
    } else {
      onPlayRequest(playerKey) 
    }
  }

  const handleSeek = (newPosition: number[]) => {
    if (!audioRef.current) return;

    let seekTime = newPosition[0];
    const trackDuration = audioRef.current.duration;

    if (startTime !== undefined && endTime !== undefined) { // Segment
      seekTime = Math.max(startTime, Math.min(seekTime, endTime));
    } else if (startTime !== undefined) { // Full track with a start offset
      seekTime = Math.max(startTime, Math.min(seekTime, trackDuration));
    } else { // Full track
      seekTime = Math.max(0, Math.min(seekTime, trackDuration));
    }
    
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);

    if (audioRef.current.paused && activePlayerKey === playerKey) {
      audioRef.current.play().catch(e => console.error(`Error playing after seek [${playerKey}]:`, e));
    } else if (!audioRef.current.paused && activePlayerKey !== playerKey) {
      // If seeking on an inactive player that was somehow playing, ensure it aligns with activePlayerKey
      onPlayRequest(playerKey); // Request to make this active and play
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  // Calculate display values based on whether it's a segment or full track
  const trueDuration = duration;
  const segmentStartTime = startTime ?? 0;
  const segmentEndTime = endTime ?? trueDuration;
  
  const displayableDuration = endTime !== undefined ? (endTime - segmentStartTime) : (trueDuration - segmentStartTime);
  let displayCurrentTime = currentTime - segmentStartTime;
  // Если сегмент завершён или почти завершён, всегда показываем прогрессбар полностью
  const isSegmentFinished = endTime !== undefined && (currentTime >= endTime + 0.25) && !isElementPlaying;
  displayCurrentTime = isSegmentFinished ? displayableDuration : Math.max(0, Math.min(displayCurrentTime, displayableDuration));


  if (compact) {
    return (
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleTogglePlay}>
        {activePlayerKey === playerKey && isElementPlaying ? <Pause size={16} /> : <Play size={16} />}
      </Button>
    )
  }

  return (
    <div className={`p-3 rounded-lg shadow-sm border ${compact ? 'bg-transparent' : 'bg-gray-50 dark:bg-gray-800'}`}>
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={handleTogglePlay} className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
          {activePlayerKey === playerKey && isElementPlaying ? <Pause className="h-6 w-6 text-[#6a50d3]" /> : <Play className="h-6 w-6 text-[#6a50d3]" />}
        </Button>
        
        <div className="flex-grow space-y-1">
          {sectionName && <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{sectionName}</p>}
          <Slider
            value={[displayCurrentTime]}
            max={displayableDuration > 0 ? displayableDuration : 100}
            step={0.1}
            onValueChange={(value) => handleSeek([value[0] + segmentStartTime])}
            className="w-full [&>span:first-child]:h-1.5 [&>span:first-child>span]:h-1.5"
            aria-label="audio progress bar"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{formatTime(displayCurrentTime)}</span>
            <span>{formatTime(displayableDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
