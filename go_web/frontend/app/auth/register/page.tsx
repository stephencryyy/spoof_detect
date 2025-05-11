import { RegisterForm } from "@/components/auth/register-form"
import { Header } from "@/components/header"
import Link from "next/link"

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-white to-purple-50">
      <Header />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Регистрация в RealTone</h1>
            <p className="text-gray-600 mt-2">Создайте аккаунт для сохранения истории проверок</p>
          </div>

          <RegisterForm />

          <div className="text-center text-sm">
            <p className="text-gray-600">
              Уже есть аккаунт?{" "}
              <Link href="/auth/login" className="text-[#6a50d3] hover:underline">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
