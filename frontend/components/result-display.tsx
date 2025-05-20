import { cn } from "@/lib/utils"
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react"

interface ResultDisplayProps {
  probability: number
}

export function ResultDisplay({ probability }: ResultDisplayProps) {
  // Format the probability as a percentage
  const formattedProbability = `${Math.round(probability)}%`

  // Determine color and icon based on probability
  const getColorClass = (value: number) => {
    if (value < 30) return "bg-green-500"
    if (value < 70) return "bg-yellow-500"
    return "bg-red-500"
  }

  const getResultIcon = (value: number) => {
    if (value < 30) return <CheckCircle className="w-5 h-5 text-green-500" />
    if (value < 70) return <AlertTriangle className="w-5 h-5 text-yellow-500" />
    return <XCircle className="w-5 h-5 text-red-500" />
  }

  const getResultText = (value: number) => {
    if (value < 30) return "Этот аудиофайл, вероятно, подлинный."
    if (value < 70) return "Этот аудиофайл имеет некоторые признаки ИИ-генерации."
    return "Этот аудиофайл, вероятно, сгенерирован ИИ."
  }

  return (
    <div className="space-y-4 w-full bg-gray-50 p-4 rounded-lg border border-gray-100">
      <div className="flex items-center justify-between">
        <p className="font-medium text-gray-700">Вероятность ИИ-генерации:</p>
        <div className="flex items-center gap-2">
          {getResultIcon(probability)}
          <span className="font-bold text-lg">{formattedProbability}</span>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={cn("h-3 rounded-full transition-all duration-1000", getColorClass(probability))}
          style={{ width: `${probability}%` }}
        />
      </div>

      <p className="text-sm text-gray-700 pt-2 border-t border-gray-200">{getResultText(probability)}</p>
    </div>
  )
}
