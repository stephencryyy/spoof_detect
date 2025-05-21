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
    // Setting audioUrl to null here will trigger the useEffect cleanup for the *current* audioUrlRef.current
    // This ensures the old URL is revoked before a new one is potentially created.
    setAudioUrl(null);

    // Reset other states
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
      setAudioUrl(newBlobUrl); // This updates audioUrl, and the useEffect will store it in audioUrlRef

      const audioElement = new Audio(newBlobUrl);
      audioElement.onloadedmetadata = () => {
        setAudioDuration(audioElement.duration);
        setShowWaveform(true);
      };
      audioElement.onerror = () => {
        setFileError('Не удалось загрузить метаданные аудиофайла.');
        setShowWaveform(false);
        // If loading the new URL fails, setAudioUrl(null) to trigger its revocation via useEffect.
        // The newBlobUrl that failed might be revoked by this call if it became audioUrlRef.current.
        setAudioUrl(null); 
        setFile(null); // Also clear the file state
        setAudioDuration(null);
        // It's also safe to directly revoke newBlobUrl here as it was problematic.
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