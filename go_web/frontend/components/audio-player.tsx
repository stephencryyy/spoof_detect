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
    setCurrentTime(startTime ?? 0) // Initialize currentTime with startTime

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      // If startTime is set, ensure currentTime is set there after metadata loads.
      if (startTime !== undefined) {
        audio.currentTime = startTime;
        setCurrentTime(startTime);
      }
    }

    audio.addEventListener("loadedmetadata", handleLoadedMetadata)

    // Cleanup function
    return () => {
      audio.pause()
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      audio.src = "" // Release the audio source
      audioRef.current = null
    }
  }, [audioUrl, startTime]) // startTime is a dependency for initial currentTime setting

  // Animation loop for progress updates
  const animationLoop = useCallback(() => {
    if (!audioRef.current || !onProgressUpdate || activePlayerKey !== playerKey) {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      return;
    }
    const currentAudioTime = audioRef.current.currentTime;
    const currentDuration = audioRef.current.duration;
    onProgressUpdate(playerKey, currentAudioTime, currentDuration);
    setCurrentTime(currentAudioTime); // Keep internal current time updated as well

    rafIdRef.current = requestAnimationFrame(animationLoop);
  }, [playerKey, activePlayerKey, onProgressUpdate, audioRef]);

  // Effect for handling play/pause based on activePlayerKey
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (activePlayerKey === playerKey) {
      if (audio.paused) {
        // Ensure we start from the correct time if segment
        if (startTime !== undefined && audio.currentTime < startTime) {
          audio.currentTime = startTime
        }
        // For segments, ensure currentTime doesn't exceed endTime if we are to play
        if (endTime !== undefined && audio.currentTime >= endTime) {
           audio.currentTime = startTime !== undefined ? startTime : 0;
        }
        audio.play().then(() => {
          if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = requestAnimationFrame(animationLoop); // Start RAF on play
        }).catch(e => console.error(`Error playing audio [${playerKey}]:`, e))
      } else {
        // Already playing and active, ensure RAF is running (e.g. if toggled quickly)
        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(animationLoop);
        }
      }
    } else {
      if (!audio.paused) {
        audio.pause()
      }
      // Stop RAF if this player is no longer active
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    }
    // Cleanup on unmount or when dependencies change that might stop the player
    return () => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    };
  }, [activePlayerKey, playerKey, startTime, endTime, audioRef, animationLoop])

  // Effect for wiring up audio events that reflect element state and report ending
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => {
        setIsElementPlaying(true);
        // Start RAF if it becomes active and plays (redundant if play() in prev effect starts it)
        // but good for cases where play is triggered by other means and this component is active.
        // if (activePlayerKey === playerKey && rafIdRef.current === null) {
        //     rafIdRef.current = requestAnimationFrame(animationLoop);
        // }
    }
    const handlePause = () => {
        setIsElementPlaying(false);
        if (rafIdRef.current) { // Stop RAF on pause
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }
    
    const handleEnded = () => {
      setIsElementPlaying(false)
      setCurrentTime(startTime ?? 0) 
      if (rafIdRef.current) { // Stop RAF on ended
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      onEnded(playerKey) 
    }

    const handleTimeUpdate = () => { // This will now be less critical for progress bar, but good for setCurrentTime
      if (!audioRef.current) return;
      const currentAudioTime = audioRef.current.currentTime;
      // const currentDuration = audioRef.current.duration; // Duration is fairly static
      setCurrentTime(currentAudioTime) // Keep internal time state updated

      // No longer call onProgressUpdate from here primarily, RAF handles it.
      // if (activePlayerKey === playerKey && onProgressUpdate) {
      //   onProgressUpdate(playerKey, currentAudioTime, currentDuration);
      // }

      if (endTime && currentAudioTime >= endTime) {
        if (!audioRef.current.paused) {
            audioRef.current.pause() 
        }
        if (activePlayerKey === playerKey) {
            setCurrentTime(endTime); 
            if (rafIdRef.current) { // Stop RAF when segment boundary reached
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
            onEnded(playerKey) 
        }
      }
    }

    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded) // Natural end of the full audio track
    audio.addEventListener("timeupdate", handleTimeUpdate)

    return () => {
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      // Ensure audioRef.current is not null before trying to access properties in cleanup for progress
      if (audioRef.current && activePlayerKey === playerKey && onProgressUpdate) {
        // When unmounting or re-evaluating, if it was active, send a final progress update (e.g., 0 or end).
        // This might be more complex depending on desired behavior on stop/switch.
        // For now, let parent handle state reset on activeKey change for simplicity.
      }
    }
  }, [audioRef, playerKey, onEnded, endTime, startTime, activePlayerKey, onProgressUpdate]) // activePlayerKey for the onEnded logic in timeupdate

  const handleTogglePlay = () => {
    if (activePlayerKey === playerKey) {
      onPlayRequest(null) // Request to deactivate this player (pause)
    } else {
      onPlayRequest(playerKey) // Request to activate this player (play)
    }
  }

  const handleSeek = (newPosition: number[]) => {
    if (!audioRef.current) return

    let seekTime = newPosition[0]
    // Constrain seekTime within [startTime, endTime] if they are defined
    if (startTime !== undefined) {
      seekTime = Math.max(seekTime, startTime);
    }
    if (endTime !== undefined) {
      seekTime = Math.min(seekTime, endTime);
    }
    
    audioRef.current.currentTime = seekTime
    setCurrentTime(seekTime)
    // If paused and seeking, and this player is meant to be active, it should play
    if (audioRef.current.paused && activePlayerKey === playerKey) {
        audioRef.current.play().catch(e => console.error(`Error playing after seek [${playerKey}]:`, e));
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return "00:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const displayStartTime = startTime ?? 0;
  const displayDuration = endTime ? endTime - displayStartTime : duration - displayStartTime;
  const displayCurrentTime = currentTime - displayStartTime;

  if (compact) {
    return (
      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleTogglePlay}>
        {activePlayerKey === playerKey ? <Pause size={16} /> : <Play size={16} />}
      </Button>
    )
  }

  // Full player UI
  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      {sectionName && <div className="mb-2 font-medium text-gray-700">{sectionName}</div>}

      <div className="flex items-center space-x-2">
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={handleTogglePlay}>
          {activePlayerKey === playerKey ? <Pause size={20} /> : <Play size={20} />}
        </Button>

        <div className="flex-1 mx-2">
          <Slider
            value={[displayCurrentTime]} // Value relative to segment start
            min={0} // Slider min is always 0 for relative segment display
            max={displayDuration > 0 ? displayDuration : 100} // Max is segment duration
            step={0.1}
            onValueChange={(value) => handleSeek([value[0] + displayStartTime])} // Convert back to absolute time
            className="cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(displayCurrentTime)}</span>
            <span>{formatTime(displayDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
