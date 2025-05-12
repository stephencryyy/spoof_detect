"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, AlertCircle, Loader2, Music } from "lucide-react"
import { AudioWaveform } from "@/components/audio-waveform"
import { AnalysisSummary } from "@/components/analysis-summary"
import { AudioPlayer } from "@/components/audio-player"
import { uploadAudio } from "../lib/api"
import type { AnalysisResultItem, UploadAudioResponse } from "../lib/types"

// Определяем тип SuspiciousSection здесь, так как он используется для состояния в этом компоненте
export interface SuspiciousSection {
  sectionNumber: number;
  startTime: number;
  endTime: number;
  probability: number; // 0-100
}

// Define the history item type
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
  const [suspiciousSections, setSuspiciousSections] = useState<SuspiciousSection[]>([])
  const [analysisResultsApi, setAnalysisResultsApi] = useState<AnalysisResultItem[] | null>(null)
  const [uploadResponse, setUploadResponse] = useState<UploadAudioResponse | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    if (selectedFile && !selectedFile.type.startsWith("audio/")) {
      setError("Пожалуйста, загрузите аудиофайл")
      setFile(null)
      setAudioUrl(null)
      setAnalysisResultsApi(null)
      setUploadResponse(null)
      return
    }

    setFile(selectedFile)
    setError(null)
    setShowWaveform(false)
    setSuspiciousSections([])
    setAnalysisResultsApi(null)
    setUploadResponse(null)

    if (selectedFile) {
      const localUrl = URL.createObjectURL(selectedFile)
      setAudioUrl(localUrl)
      setShowWaveform(true)
    } else {
      setAudioUrl(null)
      setShowWaveform(false)
    }

    const analysisResultsDiv = document.getElementById("analysis-results")
    if (analysisResultsDiv) {
      analysisResultsDiv.classList.add("hidden")
    }
  }

  const handleAnalyze = async () => {
    if (!file) return

    const token = localStorage.getItem("jwt_token")
    if (!token) {
      setError("Пожалуйста, войдите в систему, чтобы загрузить файл.")
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setSuspiciousSections([])
    setAnalysisResultsApi(null)

    try {
      const data: UploadAudioResponse = await uploadAudio(file, token)
      setUploadResponse(data)
      
      if (data.error) {
        setError(data.error)
      } else if (data.analysis_error) {
        setError(data.analysis_error)
      }

      if (data.file_url) {
        setAudioUrl(data.file_url)
      }

      if (data.analysis_results && data.analysis_results.length > 0) {
        setAnalysisResultsApi(data.analysis_results)
        const newSuspiciousSections: SuspiciousSection[] = data.analysis_results.map((item, index) => ({
          sectionNumber: index + 1,
          startTime: item.start_time_seconds,
          endTime: item.end_time_seconds,
          probability: parseFloat((item.score * 100).toFixed(2)),
        }))
        setSuspiciousSections(newSuspiciousSections)
        setShowWaveform(true)

        const overallProbability = newSuspiciousSections.reduce((acc, s) => acc + s.probability, 0) / (newSuspiciousSections.length || 1)
        saveToHistory(file, overallProbability, data.analysis_results)
      }

      const analysisResultsDiv = document.getElementById("analysis-results")
      if (analysisResultsDiv) {
        analysisResultsDiv.classList.remove("hidden")
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Произошла непредвиденная ошибка при анализе"
      setError(errorMessage)
      setUploadResponse({ message: "", s3_key: "", file_id: "", error: errorMessage })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const saveToHistory = (audioFile: File, probability: number, apiResults?: AnalysisResultItem[]) => {
    try {
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        filename: audioFile.name,
        fileSize: (audioFile.size / 1024 / 1024).toFixed(2) + " MB",
        date: new Date().toLocaleString(),
        probability: parseFloat(probability.toFixed(2)),
        analysis_results: apiResults
      }
      const existingHistory = localStorage.getItem("audioCheckHistory")
      const history: HistoryItem[] = existingHistory ? JSON.parse(existingHistory) : []
      history.unshift(newHistoryItem)
      const limitedHistory = history.slice(0, 20)
      localStorage.setItem("audioCheckHistory", JSON.stringify(limitedHistory))
    } catch (error) {
      console.error("Error saving to history:", error)
    }
  }

  const handleRetry = () => {
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl)
    }
    setFile(null)
    setError(null)
    setShowWaveform(false)
    setAudioUrl(null)
    setSuspiciousSections([])
    setAnalysisResultsApi(null)
    setUploadResponse(null)

    const analysisResultsDiv = document.getElementById("analysis-results")
    if (analysisResultsDiv) {
      analysisResultsDiv.classList.add("hidden")
    }
  }

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
          {uploadResponse && uploadResponse.message && !error && (
             <Alert variant="default" className="mb-4 w-full bg-green-50 border-green-200 text-green-700">
                <AlertDescription>{uploadResponse.message}</AlertDescription>
            </Alert>
          )}

          {!file && (
            <div className="flex flex-col items-center text-center p-8 border-2 border-dashed border-gray-300 rounded-lg w-full">
              <Upload className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-lg font-semibold text-gray-700 mb-2">Перетащите аудиофайл сюда</p>
              <p className="text-sm text-gray-500 mb-4">или</p>
              <input
                type="file"
                id="audio-upload"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="audio-upload"
                className="cursor-pointer inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Выберите файл
              </label>
              <p className="mt-3 text-xs text-gray-400">Поддерживаемые форматы: MP3, WAV, OGG и др.</p>
            </div>
          )}

          {file && (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center space-x-3">
                  <Music className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="font-medium text-gray-800 truncate max-w-xs">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleRetry} className="text-red-500 border-red-300 hover:bg-red-50">
                  Загрузить другой
                </Button>
              </div>

              {showWaveform && audioUrl && (
                <AudioWaveform 
                  audioUrl={audioUrl} 
                  analysisData={analysisResultsApi}
                />
              )}
              
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg text-lg font-semibold flex items-center justify-center space-x-2 transition-all duration-150 ease-in-out disabled:opacity-70"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Upload className="h-6 w-6" />
                )}
                <span>{isAnalyzing ? "Анализируем..." : "Анализировать"}</span>
              </Button>
            </div>
          )}

          {analysisResultsApi && analysisResultsApi.length > 0 && (
            <div id="analysis-results" className="w-full space-y-6 mt-6">
              <h3 className="text-2xl font-semibold text-gray-800 text-center">Результаты Анализа</h3>
              
              <Card>
                <CardContent className="p-6">
                  <h4 className="text-lg font-medium mb-3 text-gray-700">Анализ по сегментам:</h4>
                  {suspiciousSections.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {suspiciousSections.map((section) => (
                        <div
                          key={section.sectionNumber}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between hover:shadow-md transition-shadow duration-150"
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
                            {audioUrl && (
                               <AudioPlayer
                                audioUrl={audioUrl} 
                                startTime={section.startTime}
                                endTime={section.endTime}
                                compact={true}
                                hideVolumeControl={true}
                              />
                            )}
                          </div>
                        </div>
                      ))}
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
