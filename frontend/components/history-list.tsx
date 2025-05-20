"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle, XCircle, Trash2, Music, Loader2 } from "lucide-react"
import Link from "next/link"

import { getHistory, deleteHistoryItem, clearHistory, ApiHistoryItem } from "../lib/api";
import { useToast } from "@/hooks/use-toast"; // Предполагается, что хук useToast существует

// Используем ApiHistoryItem из lib/api.ts, переименуем для ясности в контексте компонента
interface DisplayHistoryItem extends ApiHistoryItem {
  // Можно добавить поля специфичные для отображения, если нужно
  // Например, отформатированная дата, если это не делается на бэкенде
  displayDate?: string;
}

export function HistoryList() {
  const [historyItems, setHistoryItems] = useState<DisplayHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true); // Для отслеживания состояния загрузки
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast(); // Для отображения уведомлений

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem("jwt_token"); // Получаем токен
      if (!token) {
        setError("Пользователь не авторизован. Пожалуйста, войдите в систему.");
        setIsLoading(false);
        setHistoryItems([]); // Очищаем историю, если нет токена
        return;
      }

      try {
        const data = await getHistory(token);
        // Преобразуем дату для отображения, если нужно
        const formattedData = data.map(item => ({
          ...item,
          // Пример форматирования даты, если analysis_date это ISO строка
          displayDate: new Date(item.analysis_date).toLocaleDateString('ru-RU', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        }));
        setHistoryItems(formattedData);
      } catch (err) {
        console.error("Error loading history from API:", err);
        setError(err instanceof Error ? err.message : "Не удалось загрузить историю.");
        setHistoryItems([]); // Очищаем в случае ошибки
      }
      setIsLoading(false);
    };

    fetchHistory();
  }, []);

  const handleClearHistory = async () => {
    const token = localStorage.getItem("jwt_token"); // Исправлено: используем тот же ключ
    if (!token) {
      toast({ title: "Ошибка", description: "Пользователь не авторизован.", variant: "destructive" });
      return;
    }
    try {
      await clearHistory(token);
      setHistoryItems([]);
      toast({ title: "Успех", description: "История успешно очищена." });
    } catch (err) {
      console.error("Error clearing history:", err);
      toast({ title: "Ошибка", description: err instanceof Error ? err.message : "Не удалось очистить историю.", variant: "destructive" });
    }
  };

  const handleRemoveHistoryItem = async (id: string) => {
    const token = localStorage.getItem("jwt_token"); // Исправлено: используем тот же ключ
    if (!token) {
      toast({ title: "Ошибка", description: "Пользователь не авторизован.", variant: "destructive" });
      return;
    }
    try {
      await deleteHistoryItem(id, token);
      const updatedHistory = historyItems.filter((item) => item.id !== id);
      setHistoryItems(updatedHistory);
      toast({ title: "Успех", description: "Запись успешно удалена." });
    } catch (err) {
      console.error("Error removing history item:", err);
      toast({ title: "Ошибка", description: err instanceof Error ? err.message : "Не удалось удалить запись.", variant: "destructive" });
    }
  };

  const getResultIcon = (value: number) => {
    if (value < 30) return <CheckCircle className="w-5 h-5 text-green-500" />
    if (value < 70) return <AlertTriangle className="w-5 h-5 text-yellow-500" />
    return <XCircle className="w-5 h-5 text-red-500" />
  }

  const getResultText = (value: number) => {
    if (value < 30) return "Вероятно подлинный"
    if (value < 70) return "Имеет признаки ИИ"
    return "Вероятно ИИ"
  }

  const getResultClass = (value: number) => {
    if (value < 30) return "text-green-600 bg-green-50"
    if (value < 70) return "text-yellow-600 bg-yellow-50"
    return "text-red-600 bg-red-50"
  }

  // isEmpty теперь вычисляется на основе длины historyItems
  const isEmpty = historyItems.length === 0;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center items-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-[#6a50d3]" />
        <p className="ml-2 text-gray-600">Загрузка истории...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 shadow-md bg-red-50">
        <CardContent className="p-8 flex flex-col items-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-xl font-semibold mb-2 text-red-700">Ошибка загрузки истории</h3>
          <p className="text-red-600 text-center mb-6">{error}</p>
          {error.includes("авторизован") && (
            <Link href="/auth/login">
              <Button className="bg-red-600 hover:bg-red-700 text-white">Войти</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {!isEmpty && (
        <div className="flex justify-end mb-4">
          <Button variant="outline" className="text-gray-600" onClick={handleClearHistory}>
            <Trash2 className="w-4 h-4 mr-2" />
            Очистить историю
          </Button>
        </div>
      )}

      {isEmpty ? (
        <Card className="border-purple-100 shadow-md">
          <CardContent className="p-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Music className="w-8 h-8 text-[#6a50d3]" />
            </div>
            <h3 className="text-xl font-semibold mb-2">История пуста</h3>
            <p className="text-gray-600 text-center mb-6">
              У вас пока нет проверенных аудиофайлов. Проверьте файл, чтобы увидеть его в истории.
            </p>
            <Link href="/">
              <Button className="bg-[#6a50d3] hover:bg-[#5f43cc]">Проверить аудиофайл</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {historyItems.map((item) => (
            <Card key={item.id} className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <Music className="w-5 h-5 text-[#6a50d3]" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 truncate max-w-xs">{item.filename}</h3>
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="mr-3">{item.file_size || 'N/A'}</span>
                        <span>{item.displayDate || new Date(item.analysis_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`flex items-center gap-2 px-3 py-1 rounded-full ${getResultClass(item.probability)}`}
                    >
                      {getResultIcon(item.probability)}
                      <span className="font-medium">{item.probability}%</span>
                      <span className="text-sm hidden sm:inline">{getResultText(item.probability)}</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500"
                      onClick={() => handleRemoveHistoryItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
