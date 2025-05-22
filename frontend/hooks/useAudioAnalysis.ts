import { useState, useCallback } from 'react';
import { uploadAudio } from '../lib/api';
import type { AnalysisResultItem, UploadAudioResponse } from '../lib/types';

export interface SuspiciousSection {
  sectionNumber: number;
  actualChunkNumberLabel: string;
  startTime: number;
  endTime: number;
  probability: number;
  chunk_id: string;
}

export interface AudioAnalysisControls {
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisSuccessMessage: string | null;
  suspiciousSections: SuspiciousSection[];
  analysisResultsApi: AnalysisResultItem[] | null;
  uploadResponse: UploadAudioResponse | null;
  analysisDone: boolean;
  analyzeAudio: (fileToAnalyze: File, totalAudioDuration: number) => Promise<void>;
  resetAnalysisStates: () => void;
}

export function useAudioAnalysis(): AudioAnalysisControls {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSuccessMessage, setAnalysisSuccessMessage] = useState<string | null>(null);
  const [suspiciousSections, setSuspiciousSections] = useState<SuspiciousSection[]>([]);
  const [analysisResultsApi, setAnalysisResultsApi] = useState<AnalysisResultItem[] | null>(null);
  const [uploadResponse, setUploadResponse] = useState<UploadAudioResponse | null>(null);
  const [analysisDone, setAnalysisDone] = useState(false);

  const resetAnalysisStates = useCallback(() => {
    setIsAnalyzing(false);
    setAnalysisError(null);
    setAnalysisSuccessMessage(null);
    setSuspiciousSections([]);
    setAnalysisResultsApi(null);
    setUploadResponse(null);
    setAnalysisDone(false);
  }, []);

  const analyzeAudio = useCallback(async (fileToAnalyze: File, totalAudioDuration: number) => {
    if (!fileToAnalyze) {
      setAnalysisError('Файл для анализа не предоставлен.');
      return;
    }
    if (totalAudioDuration <= 0) {
      setAnalysisError('Некорректная длительность аудиофайла для анализа.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisSuccessMessage(null);
    setAnalysisDone(false);

    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        setAnalysisError('Пользователь не авторизован. Пожалуйста, войдите в систему для анализа.');
        setIsAnalyzing(false);
        return;
      }

      const result = await uploadAudio(fileToAnalyze, token);
      setUploadResponse(result);

      if (result.error) {
        setAnalysisError(result.error);
        setAnalysisDone(false);
      } else if (result.analysis_error) {
        setAnalysisError(result.analysis_error);
        setAnalysisDone(false);
      } else if (result.analysis_results) {
        setAnalysisSuccessMessage(result.message || 'Анализ успешно завершен.');
        setAnalysisResultsApi(result.analysis_results || []);

        const apiResults = result.analysis_results || [];
        // Корректируем endTime последнего сегмента, если он чуть больше длительности файла (например, из-за MediaRecorder)
        let maxEndTime = 0;
        apiResults.forEach(item => {
          if (item.end_time_seconds > maxEndTime) maxEndTime = item.end_time_seconds;
        });
        let durationForCorrection = totalAudioDuration;
        // Если последний сегмент выходит за пределы файла не более чем на 0.2 сек, считаем это погрешностью и подрезаем
        if (maxEndTime > totalAudioDuration && maxEndTime - totalAudioDuration < 0.25) {
          durationForCorrection = maxEndTime;
        }
        const uiSuspiciousSections: SuspiciousSection[] = apiResults
          .filter(item => item.score > 0.25 && item.chunk_id)
          .map((item, index) => {
            let correctedEndTime = Math.min(item.end_time_seconds, durationForCorrection);
            let correctedStartTime = Math.min(item.start_time_seconds, correctedEndTime);
            // Если это последний сегмент и его endTime почти совпадает с duration, выставляем точно duration
            if (
              item.end_time_seconds === maxEndTime &&
              Math.abs(item.end_time_seconds - durationForCorrection) < 0.25
            ) {
              correctedEndTime = durationForCorrection;
            }
            let actualChunkNumberLabel = item.chunk_id;
            if (item.chunk_id.startsWith('chunk_')) {
              const numberPart = item.chunk_id.substring('chunk_'.length);
              const numericId = parseInt(numberPart, 10);
              if (!isNaN(numericId)) {
                actualChunkNumberLabel = (numericId + 1).toString();
              }
            }
            if (correctedEndTime > correctedStartTime) {
              return {
                sectionNumber: index + 1,
                actualChunkNumberLabel: actualChunkNumberLabel,
                startTime: correctedStartTime,
                endTime: correctedEndTime,
                probability: item.score * 100,
                chunk_id: item.chunk_id
              };
            }
            return undefined;
          })
          .filter((value): value is SuspiciousSection => Boolean(value));
        setSuspiciousSections(uiSuspiciousSections);
        setAnalysisDone(true);
      }
    } catch (error) {
      setAnalysisError('Произошла ошибка во время анализа аудио. Пожалуйста, попробуйте еще раз.');
      setAnalysisDone(false);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    isAnalyzing,
    analysisError,
    analysisSuccessMessage,
    suspiciousSections,
    analysisResultsApi,
    uploadResponse,
    analysisDone,
    analyzeAudio,
    resetAnalysisStates
  };
}
