
import { GoogleGenAI, Type } from "@google/genai";
import { WordData, SentenceData, PronunciationFeedback, SentenceEvaluation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const wordCache = new Map<string, WordData>();
const sentenceCache = new Map<string, SentenceData>();

const wordSchema = {
  type: Type.OBJECT,
  properties: {
    word: { type: Type.STRING, description: "The English word (MUST BE EXACTLY SAME as input if input is English)" },
    meaning_vi: { type: Type.STRING, description: "Main Vietnamese meaning" },
    definition_en: { type: Type.STRING, description: "Short, simple English definition (max 15 words)" },
    ipa: { type: Type.STRING },
    syllables: { type: Type.STRING },
    spelling_tip: { type: Type.STRING },
    part_of_speech: { type: Type.STRING },
    example_en: { type: Type.STRING },
    example_vi: { type: Type.STRING },
    example_b2_en: { type: Type.STRING },
    example_b2_vi: { type: Type.STRING },
    root_word: { type: Type.STRING, description: "The origin word or root of the word" },
    mnemonic: { type: Type.STRING, description: "Memory trick to remember this word" },
    synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
    antonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
    word_family: { type: Type.ARRAY, items: { type: Type.STRING } },
    collocations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["word", "meaning_vi", "definition_en", "ipa", "example_en", "example_vi", "root_word", "mnemonic"],
};

const sentenceSchema = {
  type: Type.OBJECT,
  properties: {
    sentence: { type: Type.STRING, description: "The English version of the sentence" },
    meaning_vi: { type: Type.STRING, description: "Vietnamese translation/original" },
    grammar_breakdown: { type: Type.STRING },
    usage_context: { type: Type.STRING },
    naturalness_score: { type: Type.NUMBER },
    similar_sentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          en: { type: Type.STRING },
          vi: { type: Type.STRING }
        }
      }
    }
  },
  required: ["sentence", "meaning_vi", "grammar_breakdown", "usage_context", "naturalness_score", "similar_sentences"]
};

const evaluationSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: "Score from 0 to 100" },
    corrected_sentence: { type: Type.STRING, description: "The improved/correct version of the sentence" },
    explanation_vi: { type: Type.STRING, description: "Explanation of errors and tips in Vietnamese" },
    is_natural: { type: Type.BOOLEAN, description: "Whether the sentence sounds like a native speaker" },
  },
  required: ["score", "corrected_sentence", "explanation_vi", "is_natural"],
};

const pronunciationSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER },
    is_correct: { type: Type.BOOLEAN },
    feedback_vi: { type: Type.STRING },
    detected_speech: { type: Type.STRING },
  },
  required: ["score", "is_correct", "feedback_vi", "detected_speech"],
};

export const lookupWord = async (input: string): Promise<WordData> => {
  const normalized = input.trim().toLowerCase();
  if (wordCache.has(normalized)) return wordCache.get(normalized)!;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: `Analyze this English/Vietnamese word: "${normalized}"`,
    config: {
      systemInstruction: `You are an ultra-fast bilingual dictionary.
      STRICT RULES:
      1. If input is English (e.g. 'raw', 'exit'), DO NOT change it. The "word" field MUST be the same as input.
      2. If input is Vietnamese, translate to the most precise English word first.
      3. Split 'root_word' and 'mnemonic' into separate fields.
      4. Speed is top priority. JSON output only.`,
      responseMimeType: "application/json",
      responseSchema: wordSchema,
      temperature: 0,
    },
  });
  
  const result = JSON.parse(response.text) as WordData;
  wordCache.set(normalized, result);
  return result;
};

export const lookupSentence = async (input: string): Promise<SentenceData> => {
  const normalized = input.trim();
  if (sentenceCache.has(normalized)) return sentenceCache.get(normalized)!;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: `Analyze sentence: "${normalized}"`,
    config: {
      systemInstruction: `Analyze English/Vietnamese sentence. 
      If Vietnamese, translate to natural English. 
      The "sentence" field MUST be the English version. 
      JSON only.`,
      responseMimeType: "application/json",
      responseSchema: sentenceSchema,
      temperature: 0,
    },
  });
  
  const result = JSON.parse(response.text) as SentenceData;
  sentenceCache.set(normalized, result);
  return result;
};

export const evaluateSentence = async (targetWord: string, userSentence: string): Promise<SentenceEvaluation> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Evaluate this English sentence using the word "${targetWord}": "${userSentence}"`,
    config: {
      systemInstruction: `You are an English teacher. 
      Grade the sentence (0-100), provide a corrected version, and explain errors in Vietnamese.
      Be encouraging but precise. JSON only.`,
      responseMimeType: "application/json",
      responseSchema: evaluationSchema,
      temperature: 0,
    }
  });
  return JSON.parse(response.text) as SentenceEvaluation;
};

export const checkPronunciation = async (target: string, base64Audio: string, mimeType: string): Promise<PronunciationFeedback> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Audio, mimeType: mimeType } },
        { text: `Check pronunciation for: "${target}"` }
      ]
    },
    config: {
      systemInstruction: "Pronunciation coach. Be brief. JSON output.",
      responseMimeType: "application/json",
      responseSchema: pronunciationSchema,
      temperature: 0,
    }
  });
  return JSON.parse(response.text) as PronunciationFeedback;
};
