/**
 * Dictée vocale par la reconnaissance vocale du navigateur.
 *
 * `SpeechRecognition` n'est pas disponible partout : quand elle manque,
 * `isSupported` est faux et l'interface n'affiche simplement pas le micro —
 * repli silencieux, jamais un bouton inerte.
 */

import { useRef, useState } from 'react';

interface RecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}

interface RecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResultLike };
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => RecognitionLike;

function getConstructor(): RecognitionConstructor | null {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export function useSpeechDictation(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const isSupported = getConstructor() !== null;

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const start = () => {
    const Constructor = getConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    // Le français est la langue de saisie la mieux reconnue au Niger ; la
    // réponse de l'assistante suit la langue choisie dans l'application.
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let text = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) text += result[0].transcript;
      }
      if (text.trim()) onTranscript(text.trim());
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  return { isSupported, isListening, start, stop };
}
