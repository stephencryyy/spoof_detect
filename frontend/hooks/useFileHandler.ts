import { useState, useCallback, useEffect, useRef } from 'react';

export interface FileHandlerControls {
  file: File | null;
  audioUrl: string | null;
  audioDuration: number | null;
  showWaveform: boolean;
  fileError: string | null;
  isDraggingOver: boolean;
  handleFileChange: (eventOrFile: React.ChangeEvent<HTMLInputElement> | File) => void;
  handleDragOver: (e: React.DragEvent<HTMLElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLElement>) => void;
  resetFileState: () => void;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
  setAudioUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setShowWaveform: React.Dispatch<React.SetStateAction<boolean>>;
  setAudioDuration: React.Dispatch<React.SetStateAction<number | null>>;
}

export function useFileHandler(): FileHandlerControls {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null); // Used to keep track of the URL to revoke

  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [showWaveform, setShowWaveform] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    // Store the current audioUrl in the ref for the next run's cleanup
    const previousUrl = audioUrlRef.current;
    audioUrlRef.current = audioUrl;

    // Cleanup function for the previous URL
    return () => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
    };
  }, [audioUrl]); // This effect runs when audioUrl changes or the component unmounts

  const processFile = useCallback((selectedFile: File | null) => {
    setAudioUrl(null);
    setFile(null);
    setAudioDuration(null);
    setShowWaveform(false);
    setFileError(null);

    if (selectedFile) {
      if (!selectedFile.type.startsWith('audio/')) {
        setFileError('Пожалуйста, загрузите аудиофайл');
        return;
      }

      setFile(selectedFile);
      const newBlobUrl = URL.createObjectURL(selectedFile);
      setAudioUrl(newBlobUrl);

      const audioElement = new Audio(newBlobUrl);
      audioElement.onloadedmetadata = () => {
        // Если длительность не определилась, пробуем fallback через FileReader + AudioContext
        if (isFinite(audioElement.duration) && audioElement.duration > 0) {
          setAudioDuration(audioElement.duration);
        } else {
          // Fallback: пробуем получить длительность через AudioContext
          try {
            const reader = new FileReader();
            reader.onload = function(e) {
              if (e.target && e.target.result) {
                const context = new (window.AudioContext || (window as any).webkitAudioContext)();
                context.decodeAudioData(e.target.result as ArrayBuffer, (buffer) => {
                  setAudioDuration(buffer.duration);
                  context.close();
                }, () => {
                  setAudioDuration(0);
                  context.close();
                });
              }
            };
            reader.readAsArrayBuffer(selectedFile);
          } catch {
            setAudioDuration(0);
          }
        }
        setShowWaveform(true);
      };
      audioElement.onerror = () => {
        setFileError('Не удалось загрузить метаданные аудиофайла.');
        setShowWaveform(false);
        setAudioUrl(null); 
        setFile(null);
        setAudioDuration(0); // Ставим 0, чтобы всегда было число
        URL.revokeObjectURL(newBlobUrl); 
      };
    }
  }, [setFile, setAudioUrl, setAudioDuration, setShowWaveform, setFileError]);

  const handleFileChange = useCallback((eventOrFile: React.ChangeEvent<HTMLInputElement> | File) => {
    let selectedFile: File | null = null;
    if (eventOrFile instanceof File) {
      selectedFile = eventOrFile;
    } else if (eventOrFile.target && eventOrFile.target.files) {
      selectedFile = eventOrFile.target.files[0] || null;
      if (eventOrFile.target) eventOrFile.target.value = '';
    }
    processFile(selectedFile);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [processFile]);

  const resetFileState = useCallback(() => {
    // Setting audioUrl to null will trigger its cleanup via useEffect
    setAudioUrl(null); 

    setFile(null);
    setAudioDuration(null);
    setShowWaveform(false);
    setFileError(null);
    setIsDraggingOver(false);
  }, [setFile, setAudioUrl, setAudioDuration, setShowWaveform, setFileError, setIsDraggingOver]);

  return {
    file,
    audioUrl,
    audioDuration,
    showWaveform,
    fileError,
    isDraggingOver,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    resetFileState,
    setFile,
    setAudioUrl,
    setShowWaveform,
    setAudioDuration
  };
}