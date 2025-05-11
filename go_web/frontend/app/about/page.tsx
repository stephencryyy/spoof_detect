import { Header } from "@/components/header"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-white to-purple-50">
      <Header />
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-4xl mx-auto relative">
          <Link
            href="/"
            className="absolute left-0 top-1 flex items-center text-gray-500 hover:text-[#6a50d3] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="sr-only">Назад</span>
          </Link>

          <h1 className="text-3xl font-bold text-center mb-8">О сервисе</h1>

          <div className="prose max-w-none">
            <p>Текст</p>
          </div>
        </div>
      </div>
    </main>
  )
}
