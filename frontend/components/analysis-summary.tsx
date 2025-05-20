"use client"

import { AlertTriangle } from "lucide-react"

interface SuspiciousSection {
  sectionNumber: number
  startTime: number
  endTime: number
  probability: number
}

interface AnalysisSummaryProps {
  probability: number
  suspiciousSections: SuspiciousSection[]
}

export function AnalysisSummary({ probability, suspiciousSections }: AnalysisSummaryProps) {
  // Format the section numbers for display
  const sectionNumbers = suspiciousSections.map((section) => section.sectionNumber).join(", ")

  return (
    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
      <div className="flex items-start">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <p className="font-medium text-yellow-800">Обнаружены признаки ИИ-генерации</p>
          <p className="text-gray-700 mt-1">
            Этот файл вероятно имеет признаки генерации в секциях <strong>{sectionNumbers}</strong>. Общая вероятность
            ИИ-генерации: <strong>{probability}%</strong>.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Рекомендуется внимательно прослушать отмеченные секции для подтверждения.
          </p>
        </div>
      </div>
    </div>
  )
}
