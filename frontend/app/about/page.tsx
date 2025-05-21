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
            <p>RealTone — это полностековое приложение, предназначенное для обнаружения подделок в аудиофайлах с помощью модели машинного обучения. Оно включает в себя REST API бэкенд на Go, Python gRPC сервис для анализа аудио и фронтенд на Next.js/React для взаимодействия с пользователем.</p>
            <h2>Возможности:</h2>
            <ul>
              <li><strong>Аутентификация Пользователей:</strong> Безопасная регистрация и вход пользователей.</li>
              <li><strong>Загрузка Аудиофайлов:</strong> Пользователи могут загружать аудиофайлы (WAV, MP3, OGG) для анализа.</li>
              <li><strong>Обнаружение Подделок с Помощью ИИ:</strong> Аудио анализируется Python gRPC сервисом с использованием модели на базе PyTorch/WavLM для выявления потенциальных подделок.</li>
              <li><strong>Посегментный Анализ:</strong> Аудио делится на сегменты (чанки), и каждый сегмент анализируется индивидуально.</li>
              <li><strong>Интерактивный Фронтенд:</strong>
                <ul>
                  <li>Отображает форму волны аудио и результаты анализа.</li>
                  <li>Позволяет воспроизводить полный аудиофайл и отдельные проанализированные сегменты.</li>
                  <li>Визуализирует вероятность подделки для каждого сегмента.</li>
                  <li>Динамическая визуализация прогресса во время воспроизведения сегмента.</li>
                  <li>Эксклюзивное управление воспроизведением (одновременно воспроизводится только один источник аудио).</li>
                </ul>
              </li>
              <li><strong>Сохранность Данных:</strong> Пользовательские данные и метаданные файлов хранятся в PostgreSQL. Аудиофайлы хранятся в MinIO.</li>
              <li><strong>Кэширование:</strong> Python gRPC сервис использует Redis для кэширования аудиосегментов во время обработки.</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
