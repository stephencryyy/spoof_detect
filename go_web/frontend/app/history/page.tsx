import { Header } from "@/components/header"
import { HistoryList } from "@/components/history-list"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function HistoryPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-white to-purple-50 relative overflow-hidden">
      <Header />
      <div className="container mx-auto px-4 py-8 flex-1 z-10">
        <div className="max-w-4xl mx-auto relative">
          <Link
            href="/"
            className="absolute left-0 top-1 flex items-center text-gray-500 hover:text-[#6a50d3] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="sr-only">Назад</span>
          </Link>

          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-2">История проверок</h2>
          <p className="text-center text-gray-600 max-w-2xl mx-auto mb-8">
            Здесь вы можете просмотреть результаты ранее проверенных аудиофайлов
          </p>
        </div>
        <HistoryList />
      </div>
    </main>
  )
}
