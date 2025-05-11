// frontend/lib/types.ts
export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
}

export interface RegistrationResponse {
  message: string;
  user_id: string;
  // Если бэкенд возвращает другие поля при ошибке, их можно добавить сюда
  error?: string; 
}

// Типы для Login
export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string; // или Date, если будете преобразовывать
  updated_at: string; // или Date
}

export interface LoginResponse {
  token: string;
  user: User;
  error?: string;
}

// Типы для Upload
export interface UploadAudioResponse {
  id: string; // uuid
  s3_key: string;
  message: string;
  file_url?: string;
  error?: string;
} 