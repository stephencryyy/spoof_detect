"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ResultDisplay } from "@/components/result-display"
import { Upload, AlertCircle, Loader2, Music } from "lucide-react"
import { AudioWaveform, type SuspiciousSection } from "@/components/audio-waveform"
import { AnalysisSummary } from "@/components/analysis-summary"
import { AudioPlayer } from "@/components/audio-player"
import { createRoot } from "react-dom/client"
import { uploadAudio } from "../lib/api"

// Define the history item type
interface HistoryItem {
  id: string
  filename: string
  fileSize: string
  date: string
  probability: number
}

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWaveform, setShowWaveform] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [suspiciousSections, setSuspiciousSections] = useState<SuspiciousSection[]>([])

  const summaryRootRef = useRef<ReturnType<typeof createRoot> | null>(null)
  const sectionsRootRef = useRef<ReturnType<typeof createRoot> | null>(null)

  useEffect(() => {
    if (audioUrl && (suspiciousSections.length > 0 || analysisMessage)) {
        renderAnalysisComponents()
    }
  }, [file, audioUrl, suspiciousSections, analysisMessage])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    if (selectedFile && !selectedFile.type.startsWith("audio/")) {
      setError("Пожалуйста, загрузите аудиофайл")
      setFile(null)
      setAudioUrl(null)
      return
    }

    setFile(selectedFile)
    setAnalysisMessage(null)
    setError(null)
    setShowWaveform(false)
    setSuspiciousSections([])

    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile)
      setAudioUrl(url)
    } else {
      setAudioUrl(null)
    }

    // Hide analysis results section
    const analysisResults = document.getElementById("analysis-results")
    if (analysisResults) {
      analysisResults.classList.add("hidden")
    }
  }

  const handleAnalyze = async () => {
    if (!file) return

    const token = localStorage.getItem("jwt_token")
    if (!token) {
      setError("Пожалуйста, войдите в систему, чтобы загрузить файл.")
      setIsAnalyzing(false)
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAnalysisMessage(null)

    try {
      const data = await uploadAudio(file, token)
      setAnalysisMessage(data.message || "Файл успешно загружен.")

      const analysisResults = document.getElementById("analysis-results")
      if (analysisResults) {
        analysisResults.classList.remove("hidden")
      }
      if (data.file_url) {
        console.log("File uploaded to:", data.file_url)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle sections analyzed from waveform
  const handleSectionsAnalyzed = (sections: SuspiciousSection[]) => {
    setSuspiciousSections(sections)
  }

  const renderAnalysisComponents = () => {
    if (!file || !audioUrl) return

    const summaryContainer = document.getElementById("analysis-summary-container")
    if (summaryContainer) {
      if (!summaryRootRef.current) {
        summaryRootRef.current = createRoot(summaryContainer)
      }
      summaryRootRef.current.render(<AnalysisSummary probability={0} suspiciousSections={suspiciousSections} />)
    }

    // Render Suspicious Sections
    const sectionsContainer = document.getElementById("suspicious-sections-container")
    if (sectionsContainer) {
      if (!sectionsRootRef.current) {
        sectionsRootRef.current = createRoot(sectionsContainer)
      }
      sectionsRootRef.current.render(
        <>
          {suspiciousSections.map((section) => (
            <div
              key={section.sectionNumber}
              className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-center justify-between"
            >
              <div className="flex items-center">
                <span className="font-medium text-red-700">Секция {section.sectionNumber}</span>
                <span className="ml-2 text-sm text-gray-500">
                  ({formatTime(section.startTime)} - {formatTime(section.endTime)})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-700">{section.probability}%</span>
                <AudioPlayer
                  audioUrl={audioUrl}
                  startTime={section.startTime}
                  endTime={section.endTime}
                  compact={true}
                  hideVolumeControl={true}
                />
              </div>
            </div>
          ))}
        </>,
      )
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  const saveToHistory = (audioFile: File, probability: number) => {
    try {
      // Create a new history item
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        filename: audioFile.name,
        fileSize: (audioFile.size / 1024 / 1024).toFixed(2) + " MB",
        date: new Date().toLocaleString(),
        probability: probability,
      }

      // Get existing history or initialize empty array
      const existingHistory = localStorage.getItem("audioCheckHistory")
      const history: HistoryItem[] = existingHistory ? JSON.parse(existingHistory) : []

      // Add new item to the beginning of the array
      history.unshift(newHistoryItem)

      // Limit history to 20 items
      const limitedHistory = history.slice(0, 20)

      // Save back to localStorage
      localStorage.setItem("audioCheckHistory", JSON.stringify(limitedHistory))
    } catch (error) {
      console.error("Error saving to history:", error)
    }
  }

  const handleRetry = () => {
    // Clean up object URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }

    // Instead of unmounting immediately, just mark the roots for cleanup
    // They will be properly unmounted in the next useEffect cleanup
    setFile(null)
    setError(null)
    setShowWaveform(false)
    setAudioUrl(null)
    setSuspiciousSections([])

    // Hide analysis results section
    const analysisResults = document.getElementById("analysis-results")
    if (analysisResults) {
      analysisResults.classList.add("hidden")
    }

    // Schedule root cleanup for next render cycle
    setTimeout(() => {
      if (summaryRootRef.current) {
        summaryRootRef.current.unmount()
        summaryRootRef.current = null
      }
      if (sectionsRootRef.current) {
        sectionsRootRef.current.unmount()
        sectionsRootRef.current = null
      }
    }, 0)
  }

  useEffect(() => {
    // Cleanup function to unmount roots when component unmounts
    return () => {
      // Use setTimeout to ensure this happens after any pending renders
      setTimeout(() => {
        if (summaryRootRef.current) {
          summaryRootRef.current.unmount()
          summaryRootRef.current = null
        }
        if (sectionsRootRef.current) {
          sectionsRootRef.current.unmount()
          sectionsRootRef.current = null
        }
      }, 0)
    }
  }, [])

  return (
    <Card className="w-full max-w-4xl shadow-lg transition-all border-purple-100">
      <CardContent className="p-8">
        <div className="flex flex-col items-center space-y-6">
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {analysisMessage && !error && (
            <Alert variant="default" className="border-green-500 text-green-700">
              <AlertCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>{analysisMessage}</AlertDescription>
            </Alert>
          )}

          {!file ? (
            <div className="w-full">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <Music className="w-8 h-8 text-[#6a50d3]" />
                </div>
              </div>
              <p className="text-center mb-4 text-gray-700 font-medium">Чтобы проверить аудиоконтент загрузите файл</p>
              <label
                htmlFor="audio-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-purple-200 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-purple-50 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-10 h-10 mb-3 text-[#6a50d3]" />
                  <p className="mb-2 text-sm font-medium text-[#6a50d3]">
                    <span className="font-semibold">Upload audio file</span>
                  </p>
                  <p className="text-xs text-gray-500">.mp3, .wav, .ogg</p>
                </div>
                <input id="audio-upload" type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg flex items-center">
                <div className="w-10 h-10 bg-[#6a50d3] rounded-full flex items-center justify-center mr-3">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 truncate">
                  <p className="text-sm font-medium text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>

              {/* Audio Waveform - only show after analysis */}
              {showWaveform && <AudioWaveform audioFile={file} onSectionsAnalyzed={handleSectionsAnalyzed} />}

              {/* {result !== null ? (
                <ResultDisplay probability={result} />
              ) : (
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full bg-[#6a50d3] hover:bg-[#5f43cc] text-white py-6"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Check authenticity"
                  )}
                </Button>
              )} */}
            </div>
          )}

          {file && !isAnalyzing && (
            <div className="text-center">
                <Button onClick={handleAnalyze} className="w-full md:w-auto bg-[#6a50d3] hover:bg-[#5f43cc]">
                    <Upload className="mr-2 h-4 w-4" />
                    Анализировать
                </Button>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#6a50d3]" />
              <p className="ml-3 text-gray-600">Анализ аудио...</p>
            </div>
          )}

          {/* Условное отображение результатов анализа */}
          {/* Секция результатов анализа (была скрыта по умолчанию) */}
          <div id="analysis-results" className="mt-6 space-y-4 hidden">
              {/* Контейнер для AnalysisSummary */} 
              {/* Убрали ResultDisplay, так как он ожидает probability */} 
              {/* Вместо него выше есть Alert для analysisMessage */} 
              
              {showWaveform && file && (
                  <AudioWaveform audioFile={file} onSectionsAnalyzed={handleSectionsAnalyzed} />
              )}

              <div id="analysis-summary-container"></div>
              
              {suspiciousSections.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">Подозрительные секции:</h3>
                  <div id="suspicious-sections-container" className="space-y-3"></div>
                </div>
              )}
          </div>

          {(error || analysisMessage) && !isAnalyzing && (
              <div className="text-center mt-4">
                   <Button variant="outline" onClick={handleRetry} className="w-full md:w-auto">
                      Загрузить другой файл
                   </Button>
              </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
