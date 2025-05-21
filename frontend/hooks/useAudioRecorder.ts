import { useState, useRef, useEffect, useCallback } from "react";

export interface AudioRecorderControls {
  isRecording: boolean;
  recordingError: string | null;
  stringAmplitude: number;
  smoothedAmplitude: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  recordedFile: File | null;
}

export function useAudioRecorder(): AudioRecorderControls {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);

  const [stringAmplitude, setStringAmplitude] = useState(0);
  const [smoothedAmplitude, setSmoothedAmplitude] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const startStringAnimation = useCallback((stream: MediaStream) => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const animate = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(dataArray);
      let min = 255, max = 0;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] < min) min = dataArray[i];
        if (dataArray[i] > max) max = dataArray[i];
      }
      const amplitude = (max - min) / 255;
      setStringAmplitude(amplitude);
      setSmoothedAmplitude(prev => prev + (amplitude - prev) * 0.07);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
  }, []);

  const stopStringAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setStringAmplitude(0);
    setSmoothedAmplitude(0);
  }, []);

  const startRecording = useCallback(async () => {
    setRecordedFile(null);
    setRecordingError(null);
    setIsRecording(false);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        let mimeType = 'audio/wav';
        const options: MediaRecorderOptions = {};
        if (MediaRecorder.isTypeSupported('audio/wav; codecs=MS_PCM')) {
          options.mimeType = 'audio/wav; codecs=MS_PCM';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
          options.mimeType = 'audio/wav';
        } else if (MediaRecorder.isTypeSupported('audio/webm; codecs=opus')) {
          options.mimeType = 'audio/webm; codecs=opus';
          console.warn('audio/wav not supported, falling back to audio/webm');
        } else {
          console.warn('audio/wav and audio/webm not supported, using browser default');
        }

        mediaRecorderRef.current = new MediaRecorder(stream, options.mimeType ? options : undefined);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const fileExtension = actualMimeType.includes('wav') ? 'wav' :
                                actualMimeType.includes('webm') ? 'webm' :
                                actualMimeType.includes('ogg') ? 'ogg' : 'audio';

          const now = new Date();
          const utc = now.getTime() + now.getTimezoneOffset() * 60000;
          const msk = new Date(utc + 3 * 60 * 60000);
          const pad = (n: number) => n.toString().padStart(2, '0');
          const dateStr = `${pad(msk.getDate())}-${pad(msk.getMonth() + 1)}-${pad(msk.getFullYear())}`;
          const timeStr = `${pad(msk.getHours())}:${pad(msk.getMinutes())}`;
          const audioFileName = `Audiofile_${dateStr}_${timeStr}.${fileExtension}`;

          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          const newRecordedFile = new File([audioBlob], audioFileName, { type: actualMimeType });

          setRecordedFile(newRecordedFile);

          stream.getTracks().forEach(track => track.stop());
          stopStringAnimation();
          setIsRecording(false); // Set isRecording to false when stop is complete
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        startStringAnimation(stream);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        const errorMessage = err instanceof Error ? err.message : "Неизвестная ошибка микрофона";
        setRecordingError(`Не удалось получить доступ к микрофону. Проверьте разрешения. (${errorMessage})`);
        setIsRecording(false);
        stopStringAnimation(); // Ensure animation stops on error too
      }
    } else {
      setRecordingError("Запись аудио не поддерживается в вашем браузере.");
      setIsRecording(false);
    }
  }, [startStringAnimation, stopStringAnimation]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); // This will trigger onstop, which then sets isRecording to false and stops animation
    } else {
      // If not recording or no mediaRecorder, ensure states are reset
      setIsRecording(false);
      stopStringAnimation();
    }
  }, [isRecording, stopStringAnimation]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current?.stream?.getTracks().forEach(track => track.stop());
      stopStringAnimation();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, [stopStringAnimation]);

  return {
    isRecording,
    recordingError,
    stringAmplitude,
    smoothedAmplitude,
    startRecording,
    stopRecording,
    recordedFile
  };
} 