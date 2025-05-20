"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { loginUser } from "../../lib/api"
import type { LoginRequest } from "../../lib/types"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleShowPassword = () => {
    setShowPassword(prev => !prev)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!email || !password) {
      setError("Пожалуйста, заполните все поля")
      setIsLoading(false)
      return
    }

    const credentials: LoginRequest = { email, password }

    try {
      const response = await loginUser(credentials)
      localStorage.setItem("jwt_token", response.token)
      localStorage.setItem("current_user", JSON.stringify(response.user))
      localStorage.removeItem("user")
      window.dispatchEvent(new Event("authChange"))
      router.push("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при входе. Пожалуйста, попробуйте снова.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-purple-100">
      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Пароль</Label>
              <a href="#" className="text-xs text-[#6a50d3] hover:underline">
                Забыли пароль?
              </a>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="pr-12"
              />
              <button
                type="button"
                onClick={toggleShowPassword}
                disabled={isLoading}
                className="absolute inset-y-0 right-3 flex items-center"
              >
                {showPassword ? (
                  <Eye className="h-5 w-5 text-[#6a50d3]" />
                ) : (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#6a50d3] hover:bg-[#5f43cc]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Вход...
              </>
            ) : (
              "Войти"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}