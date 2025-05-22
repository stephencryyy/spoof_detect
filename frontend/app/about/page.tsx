import { Header } from "@/components/header"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AboutPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-white to-[#6a50d3]/10 overflow-x-hidden">
      <Header />
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-5xl mx-auto relative">
          <Link
            href="/"
            className="absolute left-0 top-0 flex items-center text-gray-500 hover:text-[#6a50d3] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-4">
            О сервисе RealTone
          </h2>
          <section className="mb-16">
            <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 text-gray-700 leading-relaxed">
              <p className="text-lg md:text-xl mb-6">
                <strong>RealTone</strong> — это инновационное полностековое приложение, созданное для высокоточного обнаружения подделок в аудиофайлах. Мы используем передовые модели машинного обучения для глубокого анализа звука.
              </p>
              <p className="text-lg md:text-xl mb-6">
                Наша система объединяет мощный REST API на <code className="bg-[#6a50d3]/10 text-[#6a50d3] px-2 py-1 rounded-md text-sm">Go</code>, специализированный Python gRPC сервис для аудиоаналитики и интуитивно понятный фронтенд на <code className="bg-[#6a50d3]/10 text-[#6a50d3] px-2 py-1 rounded-md text-sm">Next.js/React</code>, предоставляя пользователям удобный инструмент для проверки аутентичности аудио.
              </p>
              <p className="text-lg md:text-xl">
                Мы стремимся предоставить надежное и простое в использовании решение для борьбы с аудио-дипфейками и защиты от дезинформации.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
