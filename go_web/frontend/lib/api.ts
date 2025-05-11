import type { RegistrationRequest, LoginRequest, LoginResponse, UploadAudioResponse } from './types';

// Определение RegistrationResponse для полноты, хотя оно используется в registerUser
interface RegistrationResponse {
  message: string;
  user_id: string;
  error?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';

export async function registerUser(userData: RegistrationRequest): Promise<RegistrationResponse> {
  const response = await fetch(`${API_BASE_URL}/users/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.error || responseData.message || `HTTP error! status: ${response.status}`);
  }

  return responseData as RegistrationResponse;
}

export async function loginUser(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.error || responseData.message || `HTTP error! status: ${response.status}`);
  }

  return responseData as LoginResponse;
}

// Функция для загрузки аудио через наш Next.js API Route
export async function uploadAudio(file: File, token: string): Promise<UploadAudioResponse> {
  const formData = new FormData();
  formData.append("audiofile", file); // "audiofile" - это имя поля, которое ожидает наш Next.js API route

  // Наш Next.js API route (/api/check) будет ожидать токен в заголовке Authorization
  const response = await fetch(`/api/check`, { // Вызываем наш внутренний API route
    method: 'POST',
    headers: {
      // Content-Type не указываем явно для FormData, браузер сделает это автоматически с правильным boundary
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(responseData.error || responseData.message || `HTTP error! status: ${response.status}`);
  }

  return responseData as UploadAudioResponse;
} 