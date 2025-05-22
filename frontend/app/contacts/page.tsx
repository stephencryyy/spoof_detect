import { Header } from "@/components/header"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ContactsPage() {
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
            Контакты
          </h2>

          <section className="mb-16">
            <div className="bg-white p-6 rounded-xl shadow-lg text-gray-700 leading-relaxed">
              <p className="text-lg mb-4">
                Вы можете связаться с нами по электронной почте: <a href="mailto:contact@realtone.app" className="text-[#6a50d3] hover:text-[#5f43cc] font-medium">contact@realtone.app</a>
              </p>
              <p className="text-lg">
                Или следите за нашим проектом на <a href="https://github.com/RealTone" target="_blank" rel="noopener noreferrer" className="text-[#6a50d3] hover:text-[#5f43cc] font-medium">GitHub</a> (ссылка на предполагаемый репозиторий проекта).
              </p>
            </div>
          </section>

          <hr className="my-16 border-t-2 border-[#6a50d3]/20" />

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-4">
              Разработчики
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3 text-[#6a50d3]">stephencryyy</h3>
                <p className="mb-4 text-gray-600"><a href="https://github.com/stephencryyy" target="_blank" rel="noopener noreferrer" className="text-[#6a50d3] hover:text-[#5f43cc]">github.com/stephencryyy</a></p>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/stephencryyy" 
                  alt="QR Code for stephencryyy's GitHub" 
                  className="w-[150px] h-[150px] mx-auto md:mx-0" 
                />
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3 text-[#6a50d3]">tmozzze</h3>
                <p className="mb-4 text-gray-600"><a href="https://github.com/tmozzze" target="_blank" rel="noopener noreferrer" className="text-[#6a50d3] hover:text-[#5f43cc]">github.com/tmozzze</a></p>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/tmozzze" 
                  alt="QR Code for tmozzze's GitHub" 
                  className="w-[150px] h-[150px] mx-auto md:mx-0"
                />
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300">
                <h3 className="text-xl font-semibold mb-3 text-[#6a50d3]">teshtvele</h3>
                <p className="mb-4 text-gray-600"><a href="https://github.com/teshtvele" target="_blank" rel="noopener noreferrer" className="text-[#6a50d3] hover:text-[#5f43cc]">github.com/teshtvele</a></p>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://github.com/teshtvele" 
                  alt="QR Code for teshtvele's GitHub" 
                  className="w-[150px] h-[150px] mx-auto md:mx-0"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}