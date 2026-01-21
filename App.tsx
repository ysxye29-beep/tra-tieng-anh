
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

  // Phím tắt toàn cục
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Bỏ qua nếu đang gõ trong một input/textarea khác (ngoại trừ ô tìm kiếm chính)
      const isTyping = (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && e.target !== inputRef.current;

      // Alt + 1: Chế độ từ vựng
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setSearchMode('word');
        inputRef.current?.focus();
      }
      // Alt + 2: Chế độ mẫu câu
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        setSearchMode('sentence');
        inputRef.current?.focus();
      }
      // Alt + F: Mở kho lưu trữ
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setCurrentView('flashcards');
      }
      // Alt + Q: Quay lại tìm kiếm
      if (e.altKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setCurrentView('search');
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      // Alt + C: Xóa nhanh ô tìm kiếm
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        clearSearch();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
    
    // Tránh tìm lại cùng một từ
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
      if (latestQueryRef.current === cleanQuery) setError("Lỗi tra cứu. Vui lòng kiểm tra lại kết nối.");
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
    return 'word' in item 
      ? savedWords.some(w => w.word.toLowerCase() === item.word.toLowerCase()) 
      : savedSentences.some(s => s.sentence === item.sentence);
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
            <div className="bg-emerald-500 p-1.5 rounded-lg text-gray-950 shadow-lg shadow-emerald-500/20"><Zap size={20} strokeWidth={3} /></div>
            <h1 className="text-base sm:text-xl font-black tracking-tighter text-white">FlashVocab</h1>
          </div>
          <nav className="flex items-center gap-1.5">
             <button onClick={() => setCurrentView('search')} className={`group relative p-2.5 rounded-xl transition-all ${currentView === 'search' ? 'text-emerald-400 bg-gray-900 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'text-gray-500 hover:text-white hover:bg-gray-900'}`} title="Tìm kiếm (Alt+Q)">
                <Search size={20} />
                <span className="absolute -bottom-1 -right-1 bg-gray-950 border border-gray-700 text-[7px] font-black text-gray-400 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Alt+Q</span>
             </button>
             <button onClick={() => setCurrentView('flashcards')} className={`group relative p-2.5 rounded-xl transition-all ${currentView === 'flashcards' ? 'text-emerald-400 bg-gray-900 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'text-gray-500 hover:text-white hover:bg-gray-900'}`} title="Thư viện (Alt+F)">
                <LayoutGrid size={20} />
                {(dueWordsCount + dueSentencesCount) > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-gray-950"></span>}
                <span className="absolute -bottom-1 -right-1 bg-gray-950 border border-gray-700 text-[7px] font-black text-gray-400 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Alt+F</span>
             </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto px-3 py-4 flex flex-col items-center overflow-y-auto custom-scrollbar">
        {currentView === 'search' && (
            <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-xl mb-4">
                    <div className="flex bg-gray-900 p-0.5 rounded-xl border border-gray-800 mb-4 w-fit mx-auto shadow-2xl">
                        <button onClick={() => setSearchMode('word')} className={`group relative px-6 py-2 rounded-lg text-[10px] font-black transition-all ${searchMode === 'word' ? 'bg-emerald-500 text-gray-950 shadow-lg shadow-emerald-500/10' : 'text-gray-500 hover:text-gray-300'}`}>
                          TỪ VỰNG
                          <span className="absolute -top-1 -right-1 bg-gray-950 border border-gray-800 text-[6px] text-gray-400 px-1 rounded opacity-0 group-hover:opacity-100">Alt+1</span>
                        </button>
                        <button onClick={() => setSearchMode('sentence')} className={`group relative px-6 py-2 rounded-lg text-[10px] font-black transition-all ${searchMode === 'sentence' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 'text-gray-500 hover:text-gray-300'}`}>
                          MẪU CÂU
                          <span className="absolute -top-1 -right-1 bg-gray-950 border border-gray-700 text-[6px] text-gray-400 px-1 rounded opacity-0 group-hover:opacity-100">Alt+2</span>
                        </button>
                    </div>
                    <div className="relative group/search">
                        <form onSubmit={handleSearch}>
                          <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchMode === 'word' ? "Nhập từ tiếng Anh hoặc tiếng Việt..." : "Nhập câu cần phân tích..."}
                            className="w-full bg-gray-900/50 backdrop-blur-sm text-base sm:text-lg text-white border border-gray-800 rounded-2xl py-3.5 pl-11 pr-24 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-xl placeholder:text-gray-600"
                          />
                        </form>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within/search:text-emerald-500 transition-colors" size={20} />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                          {query && (
                            <button onClick={clearSearch} className="group relative p-1.5 text-gray-600 hover:text-white bg-gray-800/50 rounded-lg transition-all" title="Xóa tìm kiếm (Alt+C)">
                              <ClearIcon size={16} />
                              <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gray-950 border border-gray-700 text-[6px] font-black text-gray-400 px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">Alt+C</span>
                            </button>
                          )}
                          <div className="hidden xs:flex bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-500/20 text-[9px] font-black text-emerald-400 items-center gap-1 shadow-inner shadow-emerald-500/5">FLASH AI</div>
                        </div>
                    </div>
                </div>

                <div className="w-full flex justify-center pb-12">
                    {loading && <LoadingSkeleton />}
                    {error && (
                      <div className="flex items-center gap-3 text-red-400 text-xs font-bold bg-red-950/20 px-5 py-3 rounded-2xl border border-red-900/30 animate-in fade-in zoom-in-95">
                        <AlertCircle size={18} />
                        {error}
                      </div>
                    )}
                    {wordData && !loading && searchMode === 'word' && (
                        <WordCard data={wordData} isSaved={isItemSaved(wordData)} onToggleSave={() => handleToggleSave(wordData)} sheetsUrl={sheetsUrl} onLookup={handleQuickLookup} />
                    )}
                    {sentenceData && !loading && searchMode === 'sentence' && (
                        <SentenceCard data={sentenceData} isSaved={isItemSaved(sentenceData)} onToggleSave={() => handleToggleSave(sentenceData)} sheetsUrl={sheetsUrl} onLookup={handleQuickLookup} />
                    )}
                    {!loading && !wordData && !sentenceData && !error && (
                        <div className="text-center text-gray-800 mt-20 opacity-10 select-none flex flex-col items-center">
                            <Quote size={56} className="mb-6" />
                            <h3 className="text-base font-black uppercase tracking-[0.3em]">Tra cứu & lưu trữ tức thì</h3>
                            <p className="text-xs font-bold uppercase tracking-[0.1em] mt-2">Dùng tổ hợp Alt+1/2 để chuyển chế độ</p>
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
