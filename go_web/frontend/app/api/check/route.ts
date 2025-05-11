// This is a mock API route for demonstration purposes
// In a real application, this would connect to an actual AI model

import { NextRequest, NextResponse } from 'next/server';

const GO_BACKEND_UPLOAD_URL = process.env.GO_BACKEND_API_URL ? `${process.env.GO_BACKEND_API_URL}/api/v1/audio/upload` : 'http://localhost:8080/api/v1/audio/upload';

export async function POST(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    // Предполагаем, что токен передается как "Bearer <token>"
    const token = authorizationHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Token missing in Authorization header' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('audiofile') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Создаем новый FormData для отправки на Go бэкенд
    const backendFormData = new FormData();
    backendFormData.append('audiofile', file, file.name);

    const backendResponse = await fetch(GO_BACKEND_UPLOAD_URL, {
      method: 'POST',
      headers: {
        // Content-Type для FormData устанавливается автоматически fetch с правильным boundary
        'Authorization': `Bearer ${token}`, // Передаем токен бэкенду
      },
      body: backendFormData,
    });

    const responseData = await backendResponse.json();

    if (!backendResponse.ok) {
      // Передаем ошибку от Go бэкенда клиенту
      return NextResponse.json(
        { error: responseData.error || responseData.message || 'Error uploading to backend' }, 
        { status: backendResponse.status }
      );
    }

    // Передаем успешный ответ от Go бэкенда клиенту
    return NextResponse.json(responseData, { status: backendResponse.status });

  } catch (error) {
    console.error('[API /api/check] Error:', error);
    let errorMessage = 'Internal Server Error';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
