"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, AlertCircle, Loader2, Music, Mic, Check, Trash2 } from "lucide-react"
import { AudioWaveform } from "@/components/audio-waveform"
import { AudioPlayer } from "@/components/audio-player"
import { useFileHandler } from "../hooks/useFileHandler"
import { useAudioRecorder } from "../hooks/useAudioRecorder"
import { useAudioAnalysis, type SuspiciousSection } from "../hooks/useAudioAnalysis"

export function UploadForm() {
  const fileHandlerOriginal = useFileHandler()
  const audioRecorderOriginal = useAudioRecorder()
  const audioAnalysisOriginal = useAudioAnalysis()

  const { 
    file, audioUrl, audioDuration, showWaveform, fileError, isDraggingOver, 
    handleFileChange, handleDragOver, handleDragLeave, handleDrop, resetFileState 
  } = fileHandlerOriginal

  const { 
    recordedFile, isRecording, recordingError, smoothedAmplitude, 
    startRecording, stopRecording 
  } = audioRecorderOriginal

  const { 
    isAnalyzing, analysisError, analysisSuccessMessage, suspiciousSections, 
    analysisResultsApi, uploadResponse, analysisDone, 
    analyzeAudio, resetAnalysisStates 
  } = audioAnalysisOriginal

  useEffect(() => {
    console.log("[UploadForm] analysisResultsApi updated:", analysisResultsApi);
  }, [analysisResultsApi]);

  const [activePlayerKey, setActivePlayerKey] = useState<string | null>(null)
  const [activePlayerProgress, setActivePlayerProgress] = useState<{ key: string, current: number, total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (recordedFile) {
      resetAnalysisStates()
      handleFileChange(recordedFile)
    }
  }, [recordedFile, handleFileChange, resetAnalysisStates])

  const handleFileChangeWrapper = (eventOrFile: React.ChangeEvent<HTMLInputElement> | File) => {
    resetAnalysisStates()
    handleFileChange(eventOrFile)
  }

  const handleDropWrapper = (e: React.DragEvent<HTMLElement>) => {
    resetAnalysisStates()
    handleDrop(e)
  }

  const handleClearFileOrRetry = () => {
    resetFileState()
    resetAnalysisStates()
    if (activePlayerKey === "waveform" || activePlayerKey?.startsWith("segment-")) {
      setActivePlayerKey(null)
      setActivePlayerProgress(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    if (isRecording) {
      stopRecording()
    }
  }

  const handleAnalyzeClick = async () => {
    if (file && audioDuration && audioDuration > 0) {
      await analyzeAudio(file, audioDuration)
    } else if (file && (!audioDuration || audioDuration <= 0)) {
      console.error("Cannot analyze: audioDuration is invalid or not set.", audioDuration);
      // Optionally, set an error state to inform the user
      // resetAnalysisStates(); // or specific error for this case
      // setAnalysisError("Не удалось определить длительность аудиофайла для анализа.");
    }
  }

  const handleRetryAnalysis = () => {
    if (file && audioDuration && audioDuration > 0) {
      analyzeAudio(file, audioDuration)
    } else if (file && (!audioDuration || audioDuration <= 0)) {
      console.error("Cannot retry analysis: audioDuration is invalid or not set.", audioDuration);
      // Optionally, set an error state
    }
  }

  const handlePlayRequest = (playerKeyToActivate: string | null) => {
    console.log('[UploadForm] handlePlayRequest, playerKeyToActivate:', playerKeyToActivate);
    setActivePlayerKey(playerKeyToActivate)
      }

  const handlePlayerEnded = (endedPlayerKey: string) => {
    if (activePlayerKey === endedPlayerKey) {
      setActivePlayerKey(null)
      setActivePlayerProgress(prev => prev && prev.key === endedPlayerKey ? null : prev)
    }
  }

  const handleProgressUpdate = useCallback((playerKey: string, currentTime: number, duration: number) => {
    setActivePlayerProgress({ key: playerKey, current: currentTime, total: duration })
  }, [setActivePlayerProgress])

  const handleStartRecordingFlow = async () => {
    handleClearFileOrRetry()
    await startRecording()
  }

  const handleStopRecordingFlow = () => {
    stopRecording()
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00"
    const minutes = Math.floor(seconds / 60)
    const secondsRemainder = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, "0")}:${secondsRemainder.toString().padStart(2, "0")}`
  }

  const formContainerClass = `w-full max-w-4xl shadow-lg transition-all border-purple-100 ${isDraggingOver ? "border-[#6a50d3] shadow-2xl ring-4 ring-[#8b78e6]" : "dark:border-gray-700"}`
  const contentBlockClass = "w-full space-y-4"

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card 
        className={formContainerClass}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropWrapper}
      >
      <CardContent className="p-8">
        <div className="flex flex-col items-center space-y-6 w-full">
            {fileError && (
              <Alert variant="destructive" className="w-full">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fileError}</AlertDescription>
              </Alert>
            )}
            {recordingError && (
              <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
                <AlertDescription>{recordingError}</AlertDescription>
            </Alert>
          )}
            {analysisError && !isAnalyzing && (
                <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{analysisError}</AlertDescription>
            </Alert>
          )}
            {analysisSuccessMessage && !analysisError && analysisDone && (
                 <Alert variant="default" className="w-full bg-green-50 border-green-200 text-green-700 dark:bg-green-900 dark:text-green-300 dark:border-green-700">
                    <AlertDescription>{analysisSuccessMessage}</AlertDescription>
            </Alert>
          )}

          {!file && !isRecording && (
            <div className={contentBlockClass}>
              <label
                htmlFor="dropzone-file-input"
                  className={`flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-150 ease-in-out mb-4 ${isDraggingOver ? 'bg-purple-100 border-purple-400 dark:bg-purple-900' : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
              >
                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                  <p className="text-sm text-center text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Перетащите аудиофайл сюда</span>
                </p>
                <input 
                  id="dropzone-file-input" 
                  type="file" 
                  className="hidden" 
                    onChange={handleFileChangeWrapper} 
                  accept="audio/*,.wav,.mp3,.ogg,.flac,.webm"
                  disabled={isAnalyzing || isRecording} 
                    ref={fileInputRef}
                />
                  <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                  Поддерживаемые форматы: MP3, WAV, OGG, FLAC, WEBM
                </p>
              </label>

                <div className="text-center text-gray-500 dark:text-gray-400 my-3">или</div>
            
              <Button
                  onClick={handleStartRecordingFlow}
                  className={`w-full py-3 rounded-lg text-lg font-semibold flex items-center justify-center bg-[#6a50d3] hover:bg-[#5f43cc] text-white`}
                disabled={isAnalyzing}
              >
                <Mic className="mr-2 h-5 w-5" />
                  Начать запись
              </Button>
            </div>
          )}
          
          {isRecording && (
              <div className="w-full flex flex-col items-center space-y-4 p-0">
                <div className="flex flex-col items-center justify-center w-full">
                    <Mic className="w-8 h-8 text-gray-700 dark:text-gray-300 mb-2" />
                    <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">Идет запись...</span>
                    <div className="w-full max-w-[95%] mx-auto bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mt-4">
                    <svg width="1000" height="100" viewBox="0 0 1000 100" style={{display:'block', width:'100%', height:'100px'}}>
                      {[0,1,2,3,4].map((idx) => {
                        let ampBase = [1, 0.8, 0.6, 0.45, 0.3][idx];
                        if (idx === 0 || idx === 3) ampBase *= 2;
                        if (idx === 4) ampBase /= 2;
                        let ampJitter = 1;
                        if (smoothedAmplitude >= 0.03) {
                          ampJitter = 1 + Math.sin(idx * 1.7 + Date.now() / (1200 + idx * 200)) * 0.25 + idx * 0.07;
                        }
                          const color = '#6a50d3';
                        const phase = idx * Math.PI / 3.5;
                        const width = 1000;
                        const height = 100;
                        const segments = 120;
                        const baseY = height / 2;
                        const amp = 8 + 180 * smoothedAmplitude * ampBase * ampJitter;
                        const effectiveAmp = smoothedAmplitude < 0.03 ? 0 : amp;
                        const points = [];
                        for (let i = 0; i <= segments; i++) {
                          const x = (width / segments) * i;
                          const direction = idx % 2 === 0 ? 1 : -1;
                          const t = Date.now() / (700 - idx * 80) + i * 0.32 * direction + phase;
                          const y = baseY + Math.sin(t) * effectiveAmp;
                          points.push(`${x},${y.toFixed(1)}`);
                        }
                        return (
                          <polyline
                            key={idx}
                            fill="none"
                            stroke={color}
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            opacity={0.7 - idx * 0.12}
                            points={points.join(' ')}
                          />
                        );
                      })}
                    </svg>
                  </div>
                </div>
                <Button variant="outline"
                      onClick={handleStopRecordingFlow}
                      className="w-full py-3 rounded-lg text-lg font-semibold flex items-center justify-center text-red-600 border-red-400 hover:bg-red-100 hover:border-red-500 dark:text-red-400 dark:border-red-500 dark:hover:bg-red-900 dark:hover:border-red-600"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Остановить запись
                  </Button>
            </div>
          )}
            
          {file && !isRecording && (
              <div className="w-full space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center space-x-3">
                  <Music className="w-6 h-6 text-[#6a50d3]" />
                  <div>
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs" title={file.name}>{file.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                        {(audioDuration !== null && audioDuration > 0) && ` (${formatTime(audioDuration)})`}
                    </p>
                  </div>
                </div>
                  <Button variant="outline" size="sm" onClick={handleClearFileOrRetry} className="text-red-600 border-red-400 hover:bg-red-100 hover:border-red-500 dark:text-red-400 dark:border-red-500 dark:hover:bg-red-900 dark:hover:border-red-600">
                    <Trash2 className="w-4 h-4 mr-1.5" />
                  Загрузить другой
                </Button>
              </div>

                {audioUrl && showWaveform && (
                <AudioWaveform 
                  audioUrl={audioUrl} 
                  analysisData={analysisResultsApi}
                  playerKey="waveform"
                  activePlayerKey={activePlayerKey}
                  onPlayRequest={handlePlayRequest}
                  onEnded={handlePlayerEnded}
                  onProgressUpdate={handleProgressUpdate}
                />
              )}
                
                {!analysisDone && !analysisError && (
                <Button
                    onClick={handleAnalyzeClick}
                  disabled={isAnalyzing || !file }
                  className="w-full bg-[#6a50d3] hover:bg-[#5f43cc] text-white py-3 rounded-lg text-lg font-semibold flex items-center justify-center space-x-2 transition-all duration-150 ease-in-out disabled:opacity-70"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                  <span>{isAnalyzing ? "Анализируем..." : "Анализировать"}</span>
                </Button>
              )}
                {analysisError && isAnalyzing && (
                    <Button disabled className="w-full bg-[#6a50d3] text-white py-3 rounded-lg text-lg font-semibold flex items-center justify-center space-x-2 opacity-70">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Анализируем... (Ошибка: {analysisError.substring(0,30)}...)</span>
                </Button>
              )}
                {analysisError && !isAnalyzing && (
                    <Button onClick={handleRetryAnalysis} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-3 rounded-lg text-lg font-semibold flex items-center justify-center space-x-2">
                        <AlertCircle className="h-6 w-6" />
                        <span>Ошибка анализа. Повторить?</span>
                    </Button>
                )}
  
                {analysisDone && !analysisError && uploadResponse && (
            <div id="analysis-results" className="w-full space-y-6 mt-6">
                    <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200 text-center">Результаты Анализа</h3>
              
                    {analysisResultsApi && analysisResultsApi.length > 0 && (
                      <Card className="dark:bg-gray-800">
                <CardContent className="p-6">
                          <h4 className="text-lg font-medium mb-4 text-gray-700 dark:text-gray-300">Анализ по сегментам:</h4>
                  {suspiciousSections.length > 0 ? (
                    <div className="space-y-1">
                      {suspiciousSections.map((section) => {
                                const segmentPlayerKey = `segment-${section.chunk_id}`;
                        const isSegmentActive = activePlayerKey === segmentPlayerKey;
                        
                        let progressPercent = 0;
                        let currentBackgroundColor = 'transparent';
                                const highlightColor = section.probability > 70 ? 'rgba(255, 0, 0, 0.1)' : (section.probability > 40 ? 'rgba(255, 255, 0, 0.1)' : 'rgba(0, 255, 0, 0.05)');
                                const darkHighlightColor = section.probability > 70 ? 'rgba(255, 0, 0, 0.2)' : (section.probability > 40 ? 'rgba(255, 255, 0, 0.2)' : 'rgba(0, 255, 0, 0.1)');

                        if (isSegmentActive && activePlayerProgress && activePlayerProgress.key === segmentPlayerKey) {
                          const segmentDuration = section.endTime - section.startTime;
                          const progressInSegment = Math.max(0, activePlayerProgress.current - section.startTime);
                          if (segmentDuration > 0) {
                            progressPercent = Math.min(100, (progressInSegment / segmentDuration) * 100);
                          }
                                  const baseColor = document.documentElement.classList.contains('dark') ? darkHighlightColor : highlightColor;
                                  currentBackgroundColor = `linear-gradient(to right, ${baseColor} ${progressPercent}%, transparent ${progressPercent}%)`;
                        }

                        console.log(`[UploadForm] Rendering AudioPlayer for segment: key=${segmentPlayerKey}, startTime=${section.startTime}, endTime=${section.endTime}`);

                        return (
                          <div
                            key={segmentPlayerKey}
                                    className={`py-3 px-2 flex items-center justify-between border-b last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-150 border-gray-200 dark:border-gray-700`}
                            style={{ background: currentBackgroundColor }}
                          >
                            <div className="flex items-center">
                                      <span className={`font-medium ${section.probability > 70 ? 'text-red-600 dark:text-red-400' : (section.probability > 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400')}`}>
                                Сегмент {section.actualChunkNumberLabel}
                              </span>
                                      <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                ({formatTime(section.startTime)} - {formatTime(section.endTime)})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                                      <span className={`text-sm font-semibold ${section.probability > 70 ? 'text-red-600 dark:text-red-400' : (section.probability > 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400')}`}>
                                        {section.probability.toFixed(0)}%
                              </span>
                                      {audioUrl && (
                                <AudioPlayer
                                          audioUrl={audioUrl} 
                                  startTime={section.startTime}
                                  endTime={section.endTime}
                                  compact={true}
                                  hideVolumeControl={true}
                                  playerKey={segmentPlayerKey}
                                  activePlayerKey={activePlayerKey}
                                  onPlayRequest={handlePlayRequest}
                                  onEnded={handlePlayerEnded}
                                  onProgressUpdate={handleProgressUpdate}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                            <p className="text-gray-600 dark:text-gray-400">Подозрительные сегменты не обнаружены.</p>
                  )}
                </CardContent>
              </Card>
                    )}
                    
                    {analysisResultsApi && suspiciousSections.length === 0 && (
                       <Alert variant="default" className="border-green-500 text-green-700 bg-green-50 dark:bg-green-900 dark:text-green-300 dark:border-green-700">
                          <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <AlertDescription>
                            Анализ завершен. Подозрительных секций с высокой вероятностью ИИ-генерации не обнаружено.
                          </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  )
}