import { Header } from "@/components/header"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ContactsPage() {
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

          <h1 className="text-3xl font-bold text-center mb-8">Контакты</h1>

          <div className="prose max-w-none">
            <h2>Свяжитесь с нами</h2>
            <p>Вы можете связаться с нами по электронной почте: <a href="mailto:contact@realtone.app">contact@realtone.app</a></p>
            <p>Или следите за нашим проектом на <a href="https://github.com/RealTone" target="_blank" rel="noopener noreferrer">GitHub</a> (ссылка на предполагаемый репозиторий проекта).</p>

            <hr className="my-8" />

            <h2>Разработчики</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 not-prose">
              <div className="border p-4 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-semibold mt-0 mb-2">stephencryyy</h3>
                <p className="my-1"><a href="https://github.com/stephencryyy" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800">https://github.com/stephencryyy</a></p>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/stephencryyy" 
                  alt="QR Code for stephencryyy's GitHub" 
                  className="w-[150px] h-[150px] mt-2 mx-auto md:mx-0" 
                />
              </div>
              
              <div className="border p-4 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-semibold mt-0 mb-2">tmozzze</h3>
                <p className="my-1"><a href="https://github.com/tmozzze" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800">https://github.com/tmozzze</a></p>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/tmozzze" 
                  alt="QR Code for tmozzze's GitHub" 
                  className="w-[150px] h-[150px] mt-2 mx-auto md:mx-0"
                />
              </div>
              
              <div className="border p-4 rounded-lg shadow hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-semibold mt-0 mb-2">teshtvele</h3>
                <p className="my-1"><a href="https://github.com/teshtvele" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800">https://github.com/teshtvele</a></p>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/teshtvele" 
                  alt="QR Code for teshtvele's GitHub" 
                  className="w-[150px] h-[150px] mt-2 mx-auto md:mx-0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
