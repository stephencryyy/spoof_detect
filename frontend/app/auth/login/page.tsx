import { LoginForm } from "@/components/auth/login-form"
import { Header } from "@/components/header"
import Link from "next/link"

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-white to-purple-50">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Вход в RealTone</h1>
            <p className="text-gray-600 mt-2">Войдите в свой аккаунт для доступа к истории проверок</p>
          </div>

          <LoginForm />

          <div className="text-center text-sm">
            <p className="text-gray-600">
              Еще нет аккаунта?{" "}
              <Link href="/auth/register" className="text-[#6a50d3] hover:underline">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
