"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle, XCircle, Trash2, Music } from "lucide-react"
import Link from "next/link"

interface HistoryItem {
  id: string
  filename: string
  fileSize: string
  date: string
  probability: number
}

export function HistoryList() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [isEmpty, setIsEmpty] = useState(false)

  useEffect(() => {
    // Load history from localStorage
    const loadHistory = () => {
      try {
        const savedHistory = localStorage.getItem("audioCheckHistory")
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory)
          setHistoryItems(parsedHistory)
          setIsEmpty(parsedHistory.length === 0)
        } else {
          setIsEmpty(true)
        }
      } catch (error) {
        console.error("Error loading history:", error)
        setIsEmpty(true)
      }
    }

    loadHistory()
  }, [])

  const clearHistory = () => {
    localStorage.removeItem("audioCheckHistory")
    setHistoryItems([])
    setIsEmpty(true)
  }

  const removeHistoryItem = (id: string) => {
    const updatedHistory = historyItems.filter((item) => item.id !== id)
    setHistoryItems(updatedHistory)
    localStorage.setItem("audioCheckHistory", JSON.stringify(updatedHistory))
    if (updatedHistory.length === 0) {
      setIsEmpty(true)
    }
  }

  const getResultIcon = (value: number) => {
    if (value < 30) return <CheckCircle className="w-5 h-5 text-green-500" />
    if (value < 70) return <AlertTriangle className="w-5 h-5 text-yellow-500" />
    return <XCircle className="w-5 h-5 text-red-500" />
  }

  const getResultText = (value: number) => {
    if (value < 30) return "Вероятно подлинный"
    if (value < 70) return "Имеет признаки ИИ"
    return "Вероятно ИИ"
  }

  const getResultClass = (value: number) => {
    if (value < 30) return "text-green-600 bg-green-50"
    if (value < 70) return "text-yellow-600 bg-yellow-50"
    return "text-red-600 bg-red-50"
  }

  return (
    <div className="max-w-4xl mx-auto">
      {!isEmpty && (
        <div className="flex justify-end mb-4">
          <Button variant="outline" className="text-gray-600" onClick={clearHistory}>
            <Trash2 className="w-4 h-4 mr-2" />
            Очистить историю
          </Button>
        </div>
      )}

      {isEmpty ? (
        <Card className="border-purple-100 shadow-md">
          <CardContent className="p-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Music className="w-8 h-8 text-[#6a50d3]" />
            </div>
            <h3 className="text-xl font-semibold mb-2">История пуста</h3>
            <p className="text-gray-600 text-center mb-6">
              У вас пока нет проверенных аудиофайлов. Проверьте файл, чтобы увидеть его в истории.
            </p>
            <Link href="/">
              <Button className="bg-[#6a50d3] hover:bg-[#5f43cc]">Проверить аудиофайл</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {historyItems.map((item) => (
            <Card key={item.id} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <Music className="w-5 h-5 text-[#6a50d3]" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 truncate max-w-xs">{item.filename}</h3>
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="mr-3">{item.fileSize}</span>
                        <span>{item.date}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`flex items-center gap-2 px-3 py-1 rounded-full ${getResultClass(item.probability)}`}
                    >
                      {getResultIcon(item.probability)}
                      <span className="font-medium">{item.probability}%</span>
                      <span className="text-sm hidden sm:inline">{getResultText(item.probability)}</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500"
                      onClick={() => removeHistoryItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
