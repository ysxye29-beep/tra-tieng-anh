
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Zap, BookOpen, AlertCircle, LayoutGrid, RotateCcw, Keyboard as KeyboardIcon, Calendar, ArrowRight, CheckCircle2, MessageSquare, Quote, X as ClearIcon, ZapOff, Timer, Settings as SettingsIcon, Cloud } from 'lucide-react';
import { WordData, SentenceData } from './types';
import { lookupWord, lookupSentence } from './services/geminiService';
import { WordCard } from './components/WordCard';
import { SentenceCard } from './components/SentenceCard';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { FlashcardPage } from './components/FlashcardPage';
import { StudySession } from './components/StudySession';
import { DetailModal } from './components/DetailModal';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'word' | 'sentence'>('word');
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [sentenceData, setSentenceData] = useState<SentenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubLoading, setIsSubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadTime, setLastLoadTime] = useState<number | null>(null);
  
  const [currentView, setCurrentView] = useState<'search' | 'flashcards' | 'study'>('search');
  const [sheetsUrl, setSheetsUrl] = useState(() => localStorage.getItem('google_sheets_url') || '');
  
  const [selectedDetail, setSelectedDetail] = useState<WordData | SentenceData | null>(null);
  const latestQueryRef = useRef('');

  const [savedWords, setSavedWords] = useState<WordData[]>(() => {
    try {
      const saved = localStorage.getItem('flashcards');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [savedSentences, setSavedSentences] = useState<SentenceData[]>(() => {
    try {
      const saved = localStorage.getItem('saved_sentences');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [studyQueue, setStudyQueue] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const now = Date.now();
  const dueWordsCount = useMemo(() => savedWords.filter(w => !w.next_review || w.next_review <= now).length, [savedWords, now]);
  const dueSentencesCount = useMemo(() => savedSentences.filter(s => !s.next_review || s.next_review <= now).length, [savedSentences, now]);

  useEffect(() => {
    if (currentView === 'search') {
      inputRef.current?.focus();
    }
  }, [currentView, searchMode]);

  useEffect(() => {
    if (currentView !== 'search' || query.trim().length < 2) {
      if (query.trim().length === 0) {
        setWordData(null);
        setSentenceData(null);
        setLastLoadTime(null);
      }
      return;
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => handleSearch(), 400);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [query, searchMode, currentView]);

  useEffect(() => localStorage.setItem('flashcards', JSON.stringify(savedWords)), [savedWords]);
  useEffect(() => localStorage.setItem('saved_sentences', JSON.stringify(savedSentences)), [savedSentences]);
  useEffect(() => localStorage.setItem('google_sheets_url', sheetsUrl), [sheetsUrl]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    latestQueryRef.current = cleanQuery;
    if (searchMode === 'word' && wordData?.word.toLowerCase() === cleanQuery.toLowerCase()) return;
    if (searchMode === 'sentence' && sentenceData?.sentence.toLowerCase() === cleanQuery.toLowerCase()) return;
    const startTime = performance.now();
    setLoading(true);
    setError(null);
    try {
      if (searchMode === 'word') {
        const result = await lookupWord(cleanQuery);
        if (latestQueryRef.current === cleanQuery) {
          setWordData(result);
          setSentenceData(null);
          setLastLoadTime(Math.round(performance.now() - startTime));
        }
      } else {
        const result = await lookupSentence(cleanQuery);
        if (latestQueryRef.current === cleanQuery) {
          setSentenceData(result);
          setWordData(null);
          setLastLoadTime(Math.round(performance.now() - startTime));
        }
      }
    } catch (err) {
      if (latestQueryRef.current === cleanQuery) setError("Lỗi tra cứu.");
    } finally {
      if (latestQueryRef.current === cleanQuery) setLoading(false);
    }
  };

  const handleQuickLookup = async (word: string) => {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    if (!cleanWord || cleanWord.length < 2) return;
    setIsSubLoading(true);
    try {
      const result = await lookupWord(cleanWord);
      setSelectedDetail(result);
    } catch (e) { console.error(e); } finally { setIsSubLoading(false); }
  };

  const clearSearch = () => {
    setQuery('');
    setWordData(null);
    setSentenceData(null);
    setError(null);
    setLastLoadTime(null);
    inputRef.current?.focus();
  };

  const isItemSaved = (item: WordData | SentenceData | null) => {
    if (!item) return false;
    return 'word' in item ? savedWords.some(w => w.word.toLowerCase() === item.word.toLowerCase()) : savedSentences.some(s => s.sentence === item.sentence);
  };

  const handleToggleSave = (item: WordData | SentenceData | null) => {
    if (!item) return;
    const isWord = 'word' in item;
    if (isWord) {
      const word = item as WordData;
      if (isItemSaved(word)) setSavedWords(prev => prev.filter(w => w.word.toLowerCase() !== word.word.toLowerCase()));
      else setSavedWords(prev => [{ ...word, srs_level: 0, next_review: Date.now() }, ...prev]);
    } else {
      const sentence = item as SentenceData;
      if (isItemSaved(sentence)) setSavedSentences(prev => prev.filter(s => s.sentence !== sentence.sentence));
      else setSavedSentences(prev => [{ ...sentence, srs_level: 0, next_review: Date.now() }, ...prev]);
    }
  };

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden">
      <header className="py-2 px-3 border-b border-gray-800 bg-gray-950/80 shrink-0 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('search')}>
            <div className="bg-emerald-500 p-1 rounded-lg text-gray-950 shadow-lg shadow-emerald-500/10"><Zap size={16} strokeWidth={3} /></div>
            <h1 className="text-sm sm:text-lg font-black tracking-tighter text-white">FlashVocab</h1>
          </div>
          <nav className="flex items-center gap-1">
             <button onClick={() => setCurrentView('search')} className={`p-2 rounded-lg transition-all ${currentView === 'search' ? 'text-emerald-400 bg-gray-900' : 'text-gray-500'}`}><Search size={18} /></button>
             <button onClick={() => setCurrentView('flashcards')} className={`relative p-2 rounded-lg transition-all ${currentView === 'flashcards' ? 'text-emerald-400 bg-gray-900' : 'text-gray-500'}`}>
                <LayoutGrid size={18} />
                {(dueWordsCount + dueSentencesCount) > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
             </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto px-2 py-2 sm:py-4 flex flex-col items-center overflow-y-auto custom-scrollbar">
        {currentView === 'search' && (
            <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-xl mb-3">
                    <div className="flex bg-gray-900 p-0.5 rounded-lg border border-gray-800 mb-3 w-fit mx-auto shadow-lg scale-90 sm:scale-100">
                        <button onClick={() => setSearchMode('word')} className={`px-4 py-1 rounded-md text-[10px] font-black transition-all ${searchMode === 'word' ? 'bg-emerald-500 text-gray-950' : 'text-gray-500'}`}>TỪ VỰNG</button>
                        <button onClick={() => setSearchMode('sentence')} className={`px-4 py-1 rounded-md text-[10px] font-black transition-all ${searchMode === 'sentence' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>MẪU CÂU</button>
                    </div>
                    <div className="relative group">
                        <form onSubmit={handleSearch}>
                          <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchMode === 'word' ? "Tra từ..." : "Tra câu..."}
                            className="w-full bg-gray-900/40 text-sm sm:text-base text-white border border-gray-800 rounded-xl py-2.5 pl-9 pr-20 focus:outline-none focus:border-emerald-500/40 transition-all shadow-md"
                          />
                        </form>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {query && <button onClick={clearSearch} className="p-1 text-gray-600 hover:text-white"><ClearIcon size={14} /></button>}
                          <div className="hidden xs:flex bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[8px] font-black text-emerald-500 items-center gap-1">AI</div>
                        </div>
                    </div>
                </div>

                <div className="w-full flex justify-center pb-6">
                    {loading && <LoadingSkeleton />}
                    {error && <div className="text-red-400 text-[10px] font-bold bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-900/30">{error}</div>}
                    {wordData && !loading && searchMode === 'word' && (
                        <WordCard data={wordData} isSaved={isItemSaved(wordData)} onToggleSave={() => handleToggleSave(wordData)} sheetsUrl={sheetsUrl} onLookup={handleQuickLookup} />
                    )}
                    {sentenceData && !loading && searchMode === 'sentence' && (
                        <SentenceCard data={sentenceData} isSaved={isItemSaved(sentenceData)} onToggleSave={() => handleToggleSave(sentenceData)} sheetsUrl={sheetsUrl} onLookup={handleQuickLookup} />
                    )}
                    {!loading && !wordData && !sentenceData && !error && (
                        <div className="text-center text-gray-800 mt-12 opacity-10 select-none flex flex-col items-center">
                            <Quote size={40} className="mb-4" />
                            <h3 className="text-sm font-black uppercase tracking-[0.2em]">Gõ để tra siêu tốc</h3>
                        </div>
                    )}
                </div>
            </div>
        )}

        {currentView === 'flashcards' && (
            <FlashcardPage words={savedWords} sentences={savedSentences} onSelectWord={setSelectedDetail} onSelectSentence={setSelectedDetail} onRemoveWord={(s) => setSavedWords(prev => prev.filter(w => w.word !== s))} onRemoveSentence={(s) => setSavedSentences(prev => prev.filter(item => item.sentence !== s))} onStartStudy={(type, mode) => { setStudyQueue([...savedWords, ...savedSentences].sort(() => Math.random() - 0.5)); setCurrentView('study'); }} onBackToSearch={() => setCurrentView('search')} sheetsUrl={sheetsUrl} onUpdateSheetsUrl={setSheetsUrl} />
        )}
      </main>

      {selectedDetail && (
        <DetailModal item={selectedDetail} onClose={() => setSelectedDetail(null)} sheetsUrl={sheetsUrl} isSaved={isItemSaved(selectedDetail)} onToggleSave={() => handleToggleSave(selectedDetail)} onLookup={handleQuickLookup} isLoading={isSubLoading} />
      )}

      {currentView === 'study' && <StudySession words={studyQueue} onComplete={() => setCurrentView('flashcards')} onUpdateWord={(w) => {
          if ('word' in w) setSavedWords(prev => prev.map(old => old.word === w.word ? w as WordData : old));
          else setSavedSentences(prev => prev.map(old => old.sentence === w.sentence ? w as SentenceData : old));
      }} />}
    </div>
  );
};

export default App;
