"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

interface AuthCheckProps {
  children: React.ReactNode
}

export function AuthCheck({ children }: AuthCheckProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Проверяем наличие JWT токена вместо старого объекта user
    const token = localStorage.getItem("jwt_token")
    const isLoggedIn = !!token // Если токен есть, считаем, что пользователь вошел

    // Добавляем главную страницу '/' в список публичных маршрутов
    const publicRoutes = ["/", "/auth/login", "/auth/register", "/about", "/how-it-works", "/contacts"]
    const isPublicRoute = publicRoutes.includes(pathname)

    if (!isLoggedIn && !isPublicRoute) {
      router.push("/auth/login")
    } else {
      setIsChecking(false)
    }

    const handleAuthChange = () => {
      // При изменении аутентификации (например, выход из системы или вход)
      // также проверяем по jwt_token
      const updatedToken = localStorage.getItem("jwt_token")
      const updatedIsLoggedIn = !!updatedToken

      // Обновляем isPublicRoute с учетом текущего pathname, если он мог измениться
      // (хотя pathname из usePathname должен быть актуальным в области видимости useEffect)
      const currentIsPublicRoute = publicRoutes.includes(pathname)

      if (!updatedIsLoggedIn && !currentIsPublicRoute) {
        // Если пользователь вышел и находится не на публичном маршруте, перенаправляем на логин
        router.push("/auth/login")
      } else if (updatedIsLoggedIn && (pathname === "/auth/login" || pathname === "/auth/register")) {
        // Если пользователь вошел и находится на странице логина/регистрации, перенаправляем на главную
        router.push("/")
      }
    }

    window.addEventListener("authChange", handleAuthChange)
    // Событие storage также полезно, если токен может быть изменен/удален в другой вкладке
    window.addEventListener("storage", (event: StorageEvent) => {
      if (event.key === "jwt_token" || event.key === "current_user") { // Слушаем изменения и jwt_token и current_user
        handleAuthChange()
      }
    })

    return () => {
      window.removeEventListener("authChange", handleAuthChange)
      window.removeEventListener("storage", handleAuthChange) // handleAuthChange достаточно, чтобы быть переданным сюда
    }
  }, [pathname, router])

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#6a50d3]"></div>
      </div>
    )
  }

  return <>{children}</>
}
