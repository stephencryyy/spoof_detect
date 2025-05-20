import { Shield, Zap, BarChart3 } from "lucide-react"

export function InfoSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full mt-16">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
          <Zap className="w-6 h-6 text-[#6a50d3]" />
        </div>
        <h3 className="text-lg font-bold mb-2">Быстрый анализ</h3>
        <p className="text-gray-600">Получите результаты анализа вашего аудиофайла в течение нескольких секунд.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
          <BarChart3 className="w-6 h-6 text-[#6a50d3]" />
        </div>
        <h3 className="text-lg font-bold mb-2">Точные результаты</h3>
        <p className="text-gray-600">
          Наша система использует передовые алгоритмы для обеспечения высокой точности определения.
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-[#6a50d3]" />
        </div>
        <h3 className="text-lg font-bold mb-2">Безопасность</h3>
        <p className="text-gray-600">
          Ваши файлы обрабатываются с соблюдением конфиденциальности и не сохраняются на серверах.
        </p>
      </div>
    </div>
  )
}
