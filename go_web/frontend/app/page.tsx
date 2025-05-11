"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/header"
import { UploadForm } from "@/components/upload-form"
import { InfoSection } from "@/components/info-section"
import { WaveBackground } from "@/components/wave-background"
import { Button } from "@/components/ui/button"

// This is a client component that will be hydrated on the client
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("jwt_token");
      setIsLoggedIn(!!token);
      setIsCheckingAuth(false);
    };

    checkAuth();

    window.addEventListener("storage", (event: StorageEvent) => {
      if (event.key === "jwt_token" || event.key === "current_user") {
        checkAuth();
      }
    });
    window.addEventListener("authChange", checkAuth);

    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("authChange", checkAuth);
    };
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-white to-purple-50 relative overflow-hidden">
      <WaveBackground />
      <Header />
      <div className="container mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center z-10">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-800 mb-4">
          Проверка подлинности аудио с помощью ИИ
        </h2>
        <p className="text-center text-gray-600 max-w-2xl mb-8">
          RealTone использует передовые технологии искусственного интеллекта для определения вероятности того, что
          аудиофайл был сгенерирован с помощью ИИ.
        </p>

        {isCheckingAuth ? (
          <div className="h-40 flex items-center justify-center">
            <p className="text-gray-500">Проверка аутентификации...</p>
          </div>
        ) : isLoggedIn ? (
          <UploadForm />
        ) : (
          <div className="w-full max-w-xl text-center p-6 bg-white rounded-lg shadow-md border border-purple-100">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Чтобы проверить файл на подлинность, необходимо:
            </h3>
            <div className="space-y-3 sm:space-y-0 sm:flex sm:justify-center sm:space-x-4">
              <Link href="/auth/login" passHref legacyBehavior>
                <Button asChild className="w-full sm:w-auto bg-[#6a50d3] hover:bg-[#5f43cc]">
                  <a>Войти</a>
                </Button>
              </Link>
              <Link href="/auth/register" passHref legacyBehavior>
                <Button asChild variant="outline" className="w-full sm:w-auto border-[#6a50d3] text-[#6a50d3] hover:bg-purple-50">
                  <a>Зарегистрироваться</a>
                </Button>
              </Link>
            </div>
          </div>
        )}

        {isLoggedIn && !isCheckingAuth && (
          <div id="analysis-results" className="w-full max-w-4xl mt-8 hidden">
            <div className="bg-white p-6 rounded-lg shadow-md border border-purple-100 mb-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Результаты анализа</h3>

              <div id="analysis-summary-container"></div>

              <div className="mt-6">
                <h4 className="font-medium text-gray-700 mb-2">Прослушать подозрительные секции:</h4>
                <div id="suspicious-sections-container" className="space-y-3"></div>
              </div>
            </div>
          </div>
        )}

        <InfoSection />
      </div>
    </main>
  )
}
