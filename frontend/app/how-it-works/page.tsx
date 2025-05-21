import { Header } from "@/components/header"
import { ArrowLeft, ShieldCheck, UploadCloud, Cpu, BarChart3, Database, Layers, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function HowItWorksPage() {
  const features = [
    {
      icon: <ShieldCheck className="w-12 h-12 text-[#6a50d3] mb-4" />,
      title: "Аутентификация Пользователей",
      description: "Безопасная регистрация и вход пользователей для защиты ваших данных.",
    },
    {
      icon: <UploadCloud className="w-12 h-12 text-[#6a50d3] mb-4" />,
      title: "Загрузка Аудиофайлов",
      description: "Пользователи могут легко загружать аудиофайлы (WAV, MP3, OGG) для последующего анализа.",
    },
    {
      icon: <Cpu className="w-12 h-12 text-[#6a50d3] mb-4" />,
      title: "Обнаружение Подделок с Помощью ИИ",
      description: "Аудио анализируется Python gRPC сервисом с использованием модели на базе PyTorch/WavLM.",
    },
    {
      icon: <BarChart3 className="w-12 h-12 text-[#6a50d3] mb-4" />,
      title: "Посегментный Анализ",
      description: "Аудио делится на сегменты, и каждый сегмент анализируется индивидуально для точности.",
    },
    {
      icon: <Layers className="w-12 h-12 text-[#6a50d3] mb-4" />,
      title: "Интерактивный Фронтенд",
      description: "Отображение формы волны, результатов анализа, воспроизведение аудио и сегментов, визуализация вероятности подделки.",
    },
    {
      icon: <Database className="w-12 h-12 text-[#6a50d3] mb-4" />,
      title: "Сохранность Данных",
      description: "Пользовательские данные и метаданные файлов хранятся в PostgreSQL. Аудиофайлы — в MinIO.",
    },
    {
      icon: <RefreshCw className="w-12 h-12 text-[#6a50d3] mb-4" />,
      title: "Кэширование",
      description: "Python gRPC сервис использует Redis для кэширования аудиосегментов во время обработки.",
    },
  ];

  const architectureComponents = [
    {
      name: "Фронтенд",
      tech: "Next.js, React, TypeScript, Tailwind CSS, WaveSurfer.js",
      description: "Интерактивный пользовательский интерфейс для взаимодействия с системой.",
    },
    {
      name: "Бэкенд - Go REST API",
      tech: "Go, Gin Gonic, PostgreSQL, MinIO",
      description: "Обрабатывает аутентификацию, загрузку файлов и управляет взаимодействием с gRPC сервисом.",
    },
    {
      name: "Бэкенд - Python gRPC Сервис",
      tech: "Python, gRPC, PyTorch/WavLM, Redis, MinIO",
      description: "Выполняет анализ аудио с использованием ML модели и управляет кэшированием.",
    },
  ];

  const dataStores = [
    { name: "PostgreSQL", purpose: "Хранит информацию о пользователях и метаданные аудиофайлов." },
    { name: "MinIO", purpose: "S3-совместимое объектное хранилище для загруженных аудиофайлов." },
    { name: "Redis", purpose: "Кэш в памяти, используемый Python gRPC сервисом." },
  ];

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
            Как это работает
          </h2>

          <section className="mb-16">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col items-center text-center">
                  {feature.icon}
                  <h3 className="text-xl font-semibold text-[#6a50d3] mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          <hr className="my-16 border-t-2 border-[#6a50d3]/20" />

          <section className="mb-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-4">Обзор Архитектуры</h2>
            <div className="space-y-10">
              {architectureComponents.map((component, index) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-2xl font-semibold text-[#6a50d3] mb-3">{component.name}</h3>
                  <p className="text-gray-600 mb-3 leading-relaxed">{component.description}</p>
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Технологии:</span> {component.tech.split(', ').map((tech, i) => (
                      <code key={i} className="bg-[#6a50d3]/10 text-[#6a50d3] px-2 py-1 rounded-md text-xs mx-0.5 whitespace-nowrap">{tech}</code>
                    ))}
                  </p>
                </div>
              ))}
            </div>
          </section>
          
          <hr className="my-16 border-t-2 border-[#6a50d3]/20" />

          <section>
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-4">Хранилища Данных</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {dataStores.map((store, index) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <h3 className="text-xl font-semibold text-[#6a50d3] mb-2">{store.name}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{store.purpose}</p>
                </div>
              ))}
            </div>
             <p className="text-center text-gray-600 mt-8 text-sm">
              Компоненты системы (за исключением Python gRPC сервиса в настоящее время) оркеструются с помощью <code className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-md">Docker Compose</code>.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
