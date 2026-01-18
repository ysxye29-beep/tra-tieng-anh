
export interface WordData {
  word: string;
  meaning_vi: string;
  definition_en: string;
  ipa: string;
  syllables: string;
  spelling_tip: string;
  part_of_speech: string;
  example_en: string;
  example_vi: string;
  example_b2_en: string;
  example_b2_vi: string;
  root_word: string;
  mnemonic: string;
  synonyms: string[];
  antonyms: string[];
  word_family: string[];
  collocations: string[];
  srs_level?: number;
  next_review?: number;
}

export interface SentenceData {
  sentence: string;
  meaning_vi: string;
  grammar_breakdown: string;
  usage_context: string;
  naturalness_score: number;
  similar_sentences: { en: string; vi: string }[];
  date_saved?: number;
  srs_level?: number;
  next_review?: number;
}

export interface PronunciationFeedback {
  score: number;
  is_correct: boolean;
  feedback_vi: string;
  detected_speech: string;
}
