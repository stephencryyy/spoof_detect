"use client"

import { Headphones, History, User } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"

export function Header() {
  const pathname = usePathname()
  const isHistoryPage = pathname === "/history"
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  // Опционально: можно добавить состояние для имени пользователя, если нужно его отображать
  // const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("jwt_token")
      setIsLoggedIn(!!token)

      // Если нужно отображать имя пользователя:
      // if (token) {
      //   const userString = localStorage.getItem("current_user")
      //   if (userString) {
      //     try {
      //       const userData = JSON.parse(userString)
      //       setUsername(userData.username || userData.email) // или другое поле
      //     } catch (e) {
      //       setUsername(null)
      //     }
      //   } else {
      //     setUsername(null)
      //   }
      // } else {
      //   setUsername(null)
      // }
    }

    checkAuth()
    window.addEventListener("storage", (event: StorageEvent) => {
      // Слушаем изменения jwt_token или current_user для обновления состояния
      if (event.key === "jwt_token" || event.key === "current_user" || event.key === "user") {
        checkAuth()
      }
    })
    window.addEventListener("authChange", checkAuth)

    return () => {
      window.removeEventListener("storage", checkAuth) // checkAuth здесь может быть не идеальным, но для простоты оставим
      window.removeEventListener("authChange", checkAuth)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("jwt_token")
    localStorage.removeItem("current_user")
    localStorage.removeItem("user") // На всякий случай, если старый ключ остался
    setIsLoggedIn(false)
    // setUsername(null) // Если используется имя пользователя

    window.dispatchEvent(new Event("authChange"))
    // Вместо window.location.href для Next.js лучше использовать router.push, 
    // но router не инициализирован здесь. Для простоты пока оставим window.location.href
    // или можно будет передать router или использовать хук useRouter, если компонент будет этого требовать.
    window.location.href = "/auth/login" 
  }

  return (
    <header className="w-full bg-white border-b border-gray-100 shadow-sm py-4 px-6 z-10">
      <div className="max-w-7xl mx-auto flex items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <div className="w-10 h-10 bg-[#6a50d3] rounded-full flex items-center justify-center mr-3">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">RealTone</h1>
          </Link>
        </div>

        <div className="ml-auto hidden md:flex space-x-4">
          <Link href="/about" className="text-gray-600 hover:text-[#6a50d3] transition-colors">
            О сервисе
          </Link>
          <Link href="/how-it-works" className="text-gray-600 hover:text-[#6a50d3] transition-colors">
            Как это работает
          </Link>
          <Link href="/contacts" className="text-gray-600 hover:text-[#6a50d3] transition-colors">
            Контакты
          </Link>
        </div>

        <div className="ml-4 flex items-center space-x-4">
          {isLoggedIn && !isHistoryPage && (
            <Link href="/history">
              <Button
                variant="outline"
                className="flex items-center gap-2 border-[#6a50d3] text-[#6a50d3] hover:bg-purple-50"
              >
                <History className="w-4 h-4" />
                История проверок
              </Button>
            </Link>
          )}
          {/* Тут можно добавить отображение имени пользователя, если isLoggedIn && username */} 

          {isLoggedIn ? (
            <Button variant="ghost" className="text-gray-600 hover:text-[#6a50d3]" onClick={handleLogout}>
              Выйти
            </Button>
          ) : (
            <Link href="/auth/login">
              <Button variant="ghost" className="flex items-center gap-2 text-gray-600 hover:text-[#6a50d3]">
                <User className="w-4 h-4" />
                Войти
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
