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

// Определение структуры для одного элемента в analysis_results
export interface AnalysisResultItem {
  chunk_id: string;
  score: number; // Уже округленное до 4 знаков
  start_time_seconds: number;
  end_time_seconds: number;
}

// Типы для Upload
export interface UploadAudioResponse {
  file_id: string; // Переименовано из id для соответствия с Go бэкендом
  s3_key: string;
  message: string;
  file_url?: string;
  analysis_error?: string; // Ошибка от Python сервиса, если была
  analysis_results?: AnalysisResultItem[]; // Массив результатов анализа
  error?: string; // Общая ошибка от /api/check или Go API (не связанная с Python-анализом)
} 