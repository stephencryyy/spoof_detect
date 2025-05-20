"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, AlertCircle, Loader2, Music, Mic } from "lucide-react"
import { AudioWaveform } from "@/components/audio-waveform"
// import { AnalysisSummary } from "@/components/analysis-summary" // Если не используется, можно убрать
import { AudioPlayer } from "@/components/audio-player"
import { uploadAudio } from "../lib/api"
import type { AnalysisResultItem, UploadAudioResponse } from "../lib/types"

export interface SuspiciousSection {
  sectionNumber: number;
  startTime: number;
  endTime: number;
  probability: number; // 0-100
  chunk_id: string;
}

interface HistoryItem {
  id: string
  filename: string
  fileSize: string
  date: string
  probability: number
  analysis_results?: AnalysisResultItem[]
}

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWaveform, setShowWaveform] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [localFileBlobUrl, setLocalFileBlobUrl] = useState<string | null>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [suspiciousSections, setSuspiciousSections] = useState<SuspiciousSection[]>([])
  const [analysisResultsApi, setAnalysisResultsApi] = useState<AnalysisResultItem[] | null>(null)
  const [uploadResponse, setUploadResponse] = useState<UploadAudioResponse | null>(null)
  const [activePlayerKey, setActivePlayerKey] = useState<string | null>(null);
  const [activePlayerProgress, setActivePlayerProgress] = useState<{ key: string, current: number, total: number } | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false); // Новое состояние для отслеживания перетаскивания
  const [analysisDone, setAnalysisDone] = useState(false); // Новый флаг для отслеживания завершения анализа

  useEffect(() => {
    const currentBlobUrl = localFileBlobUrl;
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [localFileBlobUrl]);

  const resetAnalysisStates = () => {
    setSuspiciousSections([]);
    setAnalysisResultsApi(null);
    setUploadResponse(null);
    setError(null);
    const analysisResultsDiv = document.getElementById("analysis-results");
    if (analysisResultsDiv) {
      analysisResultsDiv.classList.add("hidden");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;

    if (localFileBlobUrl) {
      URL.revokeObjectURL(localFileBlobUrl);
      setLocalFileBlobUrl(null);
    }
    resetAnalysisStates();

    if (selectedFile && !selectedFile.type.startsWith("audio/")) {
      setError("Пожалуйста, загрузите аудиофайл");
      setFile(null);
      setAudioUrl(null);
      setAudioDuration(null);
      setShowWaveform(false);
      return;
    }

    setFile(selectedFile);
    setShowWaveform(false);
    setAudioDuration(null);

    if (selectedFile) {
      const newBlobUrl = URL.createObjectURL(selectedFile);
      setAudioUrl(newBlobUrl);
      setLocalFileBlobUrl(newBlobUrl);
      
      const audioElement = new Audio(newBlobUrl);
      audioElement.onloadedmetadata = () => {
        setAudioDuration(audioElement.duration);
        setShowWaveform(true);
      };
      audioElement.onerror = () => {
        setError("Не удалось загрузить метаданные аудиофайла.");
        setShowWaveform(false);
      }
    } else {
      setAudioUrl(null);
      setShowWaveform(false);
    }
  };

  const handleStartRecording = async () => {
    if (localFileBlobUrl) {
      URL.revokeObjectURL(localFileBlobUrl);
    }
    setFile(null);
    setAudioUrl(null);
    setLocalFileBlobUrl(null);
    setShowWaveform(false);
    setAudioDuration(null);
    resetAnalysisStates();
    setRecordingError(null);
    
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        let mimeType = 'audio/wav';
        const options: MediaRecorderOptions = {}; // MediaRecorderOptions
        if (MediaRecorder.isTypeSupported('audio/wav; codecs=MS_PCM')) {
            options.mimeType = 'audio/wav; codecs=MS_PCM';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
            options.mimeType = 'audio/wav';
        } else if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
            options.mimeType = 'audio/webm; codecs=opus';
            console.warn('audio/wav not supported, falling back to audio/webm');
        } else {
            console.warn('audio/wav and audio/webm not supported, using browser default');
        }

        mediaRecorderRef.current = new MediaRecorder(stream, options.mimeType ? options : undefined);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const fileExtension = actualMimeType.includes('wav') ? 'wav' : 
                                actualMimeType.includes('webm') ? 'webm' : 
                                actualMimeType.includes('ogg') ? 'ogg' : 'audio';

          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          const audioFileName = `recording-${new Date().toISOString()}.${fileExtension}`;
          const recordedFile = new File([audioBlob], audioFileName, { type: actualMimeType });
          
          setFile(recordedFile);
          const newBlobUrl = URL.createObjectURL(recordedFile);
          setAudioUrl(newBlobUrl);
          setLocalFileBlobUrl(newBlobUrl);
          
          const audioElement = new Audio(newBlobUrl);
          audioElement.onloadedmetadata = () => {
            setAudioDuration(audioElement.duration);
            setShowWaveform(true);
          };
          audioElement.onerror = () => {
            setError("Не удалось загрузить метаданные для записанного аудио.");
            setShowWaveform(false);
          }
          
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка микрофона";
        setRecordingError(`Не удалось получить доступ к микрофону. Проверьте разрешения. (${errorMessage})`);
        setIsRecording(false);
      }
    } else {
      setRecordingError("Запись аудио не поддерживается в вашем браузере.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAnalyze = async () => { 
    if (!file) {
      setError("Файл для анализа не выбран или не записан.");
      setIsAnalyzing(false);
      return;
    }

    let currentAudioDuration = audioDuration;
    if (currentAudioDuration === null || currentAudioDuration === 0 || isNaN(currentAudioDuration)) {
       if (localFileBlobUrl) {
        const audioElement = new Audio(localFileBlobUrl);
        try {
            currentAudioDuration = await new Promise<number>((resolve, reject) => {
                audioElement.onloadedmetadata = () => {
                    setAudioDuration(audioElement.duration); // Обновляем состояние
                    resolve(audioElement.duration);
                };
                audioElement.onerror = () => {
                    reject(new Error("Не удалось определить длительность аудиофайла перед анализом."));
                };
            });
        } catch (e) {
            const errMessage = e instanceof Error ? e.message : "Ошибка получения длительности";
            setError(errMessage);
            setIsAnalyzing(false);
            return;
        }
       } else {
        setError("Не удалось определить длительность аудиофайла (нет URL). Анализ невозможен.");
        setIsAnalyzing(false);
        return;
       }
    }
    // Еще одна проверка после попытки получить длительность
    if (currentAudioDuration === null || currentAudioDuration === 0 || isNaN(currentAudioDuration)) {
        setError("Не удалось определить валидную длительность аудиофайла. Анализ невозможен.");
        setIsAnalyzing(false);
        return;
    }


    const token = localStorage.getItem("jwt_token");
    if (!token) {
      setError("Пожалуйста, войдите в систему, чтобы загрузить файл.");
      setIsAnalyzing(false);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSuspiciousSections([]);
    setAnalysisResultsApi(null);
    setAnalysisDone(false); // Сброс перед анализом

    try {
      const data: UploadAudioResponse = await uploadAudio(file, token);
      setUploadResponse(data); // Устанавливаем ответ от API
      
      if (data.error) {
        setError(data.error);
      } else if (data.analysis_error) {
        setError(data.analysis_error);
      }

      let finalAnalysisResults = data.analysis_results;
      if (currentAudioDuration !== null && finalAnalysisResults && finalAnalysisResults.length > 0) {
        finalAnalysisResults = finalAnalysisResults.map((item, index, arr) => {
          if (index === arr.length - 1) {
            const validDuration = Number.isFinite(currentAudioDuration) ? currentAudioDuration : item.end_time_seconds;
            return { ...item, end_time_seconds: Math.min(item.end_time_seconds, validDuration) };
          }
          return item;
        });
      }

      if (finalAnalysisResults && finalAnalysisResults.length > 0) {
        setAnalysisResultsApi(finalAnalysisResults);
        const newSuspiciousSections: SuspiciousSection[] = finalAnalysisResults.map((item, index) => ({
          sectionNumber: index + 1,
          startTime: item.start_time_seconds,
          endTime: item.end_time_seconds,
          probability: parseFloat((item.score * 100).toFixed(2)),
          chunk_id: item.chunk_id,
        }));
        setSuspiciousSections(newSuspiciousSections);
        saveToHistory(file, newSuspiciousSections.reduce((acc, s) => acc + s.probability, 0) / (newSuspiciousSections.length || 1), data.analysis_results);
      } else if (!data.error && !data.analysis_error) {
        setAnalysisResultsApi([]); 
        setSuspiciousSections([]);
        // Обновляем сообщение в uploadResponse, которое уже установлено из data
        setUploadResponse(prevData => {
            // prevData здесь это то, что было установлено из 'data' от API
            if (!prevData) { // На случай если prevData оказалось null, хотя не должно
                return {
                    message: "Анализ завершен. Подозрительные сегменты не обнаружены.",
                    s3_key: data?.s3_key || "", // Возьмем из data, если есть
                    file_id: data?.file_id || "", // Возьмем из data, если есть
                };
            }
            return {
                ...prevData,
                message: (prevData.message || "").includes("успешно загружен") 
                    ? "Аудиофайл успешно проанализирован. Подозрительные сегменты не обнаружены." 
                    : "Анализ завершен. Подозрительные сегменты не обнаружены."
            };
        });
      }

      const analysisResultsDiv = document.getElementById("analysis-results");
      if (analysisResultsDiv) {
        analysisResultsDiv.classList.remove("hidden");
      }

      setAnalysisDone(true); // Анализ завершен успешно или с ошибкой
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Произошла непредвиденная ошибка при анализе";
      setError(errorMessage);
      setUploadResponse({ message: "", s3_key: "", file_id: "", error: errorMessage });
      setAnalysisDone(true); // Анализ завершен с ошибкой
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const saveToHistory = (audioFile: File, probability: number, apiResults?: AnalysisResultItem[]) => {
    try {
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        filename: audioFile.name,
        fileSize: (audioFile.size / 1024 / 1024).toFixed(2) + " MB",
        date: new Date().toLocaleString(),
        probability: parseFloat(probability.toFixed(2)),
        analysis_results: apiResults
      };
      const existingHistory = localStorage.getItem("audioCheckHistory");
      const history: HistoryItem[] = existingHistory ? JSON.parse(existingHistory) : [];
      history.unshift(newHistoryItem);
      const limitedHistory = history.slice(0, 20);
      localStorage.setItem("audioCheckHistory", JSON.stringify(limitedHistory));
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const handleRetry = () => {
    if (localFileBlobUrl) {
      URL.revokeObjectURL(localFileBlobUrl);
      setLocalFileBlobUrl(null);
    }
    if (audioUrl && audioUrl.startsWith('blob:') && audioUrl !== localFileBlobUrl) {
        URL.revokeObjectURL(audioUrl);
    }

    setFile(null);
    setError(null);
    setShowWaveform(false);
    setAudioUrl(null);
    setAudioDuration(null);
    resetAnalysisStates();
    setActivePlayerKey(null);
    setActivePlayerProgress(null);

    setIsRecording(false);
    setRecordingError(null);
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setAnalysisDone(false); // Сбросить флаг при выборе нового файла
  };

  const handlePlayRequest = (playerKeyToActivate: string | null) => {
    setActivePlayerKey(prevActiveKey => {
      const newActiveKey = prevActiveKey === playerKeyToActivate ? null : playerKeyToActivate;
      if (newActiveKey === null) {
        setActivePlayerProgress(null);
      }
      return newActiveKey;
    });
  };

  const handlePlayerEnded = (endedPlayerKey: string) => {
    setActivePlayerKey(prevActiveKey => {
      if (prevActiveKey === endedPlayerKey) {
        setActivePlayerProgress(null);
        return null;
      }
      return prevActiveKey;
    });
  };

  const handleProgressUpdate = (playerKey: string, currentTime: number, duration: number) => {
    if (activePlayerKey === playerKey) {
      setActivePlayerProgress({ key: playerKey, current: currentTime, total: duration });
    }
  };

  return (
    <Card className="w-full max-w-4xl shadow-lg transition-all border-purple-100">
      <CardContent className="p-8">
        <div className="flex flex-col items-center space-y-6">
          {error && (
            <Alert variant="destructive" className="mb-4 w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {recordingError && (
            <Alert variant="destructive" className="mb-4 w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{recordingError}</AlertDescription>
            </Alert>
          )}
          {uploadResponse && uploadResponse.message && !error && !recordingError && (
             <Alert variant="default" className="mb-4 w-full bg-green-50 border-green-200 text-green-700">
                <AlertDescription>{uploadResponse.message}</AlertDescription>
            </Alert>
          )}

          {!file && !isRecording && (
            <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4">
              {/* Dashed border area - now a label for file input */}
              <label
                htmlFor="dropzone-file-input"
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-150 ease-in-out mb-4 p-4 ${
                  isDraggingOver ? 'bg-purple-100 border-purple-400' : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false);
                }}
                onDragOver={(e) => e.preventDefault()} 
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingOver(false); // Сбрасываем состояние после броска
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const droppedFile = e.dataTransfer.files[0];
                    const syntheticEvent = {
                      target: { files: [droppedFile] },
                    } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFileChange(syntheticEvent);
                  }
                }}
              >
                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                <p className="text-sm text-center text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Перетащите аудиофайл сюда</span>
                </p>
                <input 
                  id="dropzone-file-input" 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange} 
                  accept="audio/*,.wav,.mp3,.ogg,.flac,.webm"
                  disabled={isAnalyzing || isRecording} 
                />
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                  Поддерживаемые форматы: MP3, WAV, OGG, FLAC, WEBM. Запись будет в WAV или WEBM.
                </p>
              </label>

              <p className="my-3 text-sm text-gray-500 dark:text-gray-400">или</p>

              {/* Buttons container */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                <Button
                  type="button"
                  onClick={() => document.getElementById('dropzone-file-input')?.click()}
                  className="w-full bg-[#6a50d3] hover:bg-[#5f43cc] text-white py-3 text-base rounded-md flex items-center justify-center"
                  disabled={isAnalyzing || isRecording}
                >
                  <Music className="mr-2 h-5 w-5" />
                  Выберите файл
                </Button>
                <Button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className={`w-full py-3 text-base rounded-md flex items-center justify-center ${ 
                    isRecording 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-[#6a50d3] hover:bg-[#5f43cc] text-white'
                  }`}
                  disabled={isAnalyzing}
                >
                  <Mic className="mr-2 h-5 w-5" />
                  {isRecording ? "Остановить запись" : "Начать запись"}
                </Button>
              </div>

              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                Для записи разрешите браузеру доступ к микрофону.
              </p>
            </div>
          )}
          
          {isRecording && (
            <div className="w-full flex flex-col items-center space-y-4 p-8 border-2 border-dashed border-green-300 rounded-lg">
                <div className="flex items-center justify-center text-green-600 animate-pulse">
                  <Mic className="w-8 h-8 mr-2" />
                  <span className="text-lg font-semibold">Идет запись...</span>
                </div>
                <Button
                    onClick={handleStopRecording}
                    className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Остановить запись
                  </Button>
            </div>
          )}

          {file && !isRecording && (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center space-x-3">
                  <Music className="w-6 h-6 text-[#6a50d3]" />
                  <div>
                    <p className="font-medium text-gray-800 truncate max-w-xs">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                      {(audioDuration !== null && audioDuration > 0) && `  (${formatTime(audioDuration)})`}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRetry} className="text-red-600 border-red-400 hover:bg-red-100 hover:border-red-500">
                  Загрузить другой
                </Button>
              </div>

              {showWaveform && audioUrl && (
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
              {/* Кнопка Анализировать показывается только если анализ не был завершен */}
              {!analysisDone && (
                <Button
                  onClick={handleAnalyze}
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
            </div>
          )}

          {analysisResultsApi && analysisResultsApi.length > 0 && !isRecording && (
            <div id="analysis-results" className="w-full space-y-6 mt-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800 text-center">Результаты Анализа</h3>
              
              <Card>
                <CardContent className="p-6">
                  <h4 className="text-lg font-medium mb-4 text-gray-700">Анализ по сегментам:</h4>
                  {suspiciousSections.length > 0 ? (
                    <div className="space-y-1">
                      {suspiciousSections.map((section) => {
                        const segmentPlayerKey = section.chunk_id;
                        const isSegmentActive = activePlayerKey === segmentPlayerKey;
                        
                        let progressPercent = 0;
                        let currentBackgroundColor = 'transparent';
                        const highlightColor = section.probability > 70 ? 'rgba(255, 0, 0, 0.3)' : (section.probability > 40 ? 'rgba(255, 255, 0, 0.3)' : 'rgba(0, 255, 0, 0.2)');

                        if (isSegmentActive && activePlayerProgress && activePlayerProgress.key === segmentPlayerKey) {
                          const segmentDuration = section.endTime - section.startTime;
                          const progressInSegment = Math.max(0, activePlayerProgress.current - section.startTime);
                          if (segmentDuration > 0) {
                            progressPercent = Math.min(100, (progressInSegment / segmentDuration) * 100);
                          }
                          currentBackgroundColor = `linear-gradient(to right, ${highlightColor} ${progressPercent}%, transparent ${progressPercent}%)`;
                        }

                        return (
                          <div
                            key={segmentPlayerKey}
                            className={`py-3 px-2 flex items-center justify-between border-b last:border-b-0 hover:bg-gray-50 rounded-md transition-colors duration-150 border-gray-100`}
                            style={{ background: currentBackgroundColor }}
                          >
                            <div className="flex items-center">
                              <span className={`font-medium ${section.probability > 70 ? 'text-red-600' : (section.probability > 40 ? 'text-yellow-600' : 'text-green-600')}`}>
                                Сегмент {section.sectionNumber}
                              </span>
                              <span className="ml-2 text-sm text-gray-500">
                                ({formatTime(section.startTime)} - {formatTime(section.endTime)})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${section.probability > 70 ? 'text-red-600' : (section.probability > 40 ? 'text-yellow-600' : 'text-green-600')}`}>
                                {section.probability.toFixed(2)}%
                              </span>
                              {localFileBlobUrl && (
                                <AudioPlayer
                                  audioUrl={localFileBlobUrl} 
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
                    <p className="text-gray-600">Подозрительные сегменты не обнаружены.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}