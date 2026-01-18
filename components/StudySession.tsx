
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WordData, PronunciationFeedback } from '../types';
import { 
    X, RotateCw, CheckCircle, Brain, ChevronLeft, ChevronRight, 
    Clock, Volume2, VolumeX, Mic, MicOff, RefreshCw, Star, 
    AlertTriangle, Keyboard, ListChecks, Layers, Check, AlertCircle 
} from 'lucide-react';
import { checkPronunciation } from '../services/geminiService';

interface StudySessionProps {
  words: WordData[];
  onComplete: () => void;
  onUpdateWord: (word: WordData) => void;
}

type StudyMode = 'flashcard' | 'typing' | 'quiz';

const SRS_INTERVALS = [1, 3, 7, 14, 30, 90, 180];

const getNextIntervalDays = (currentLevel: number, rating: 'fail' | 'hard' | 'good' | 'easy') => {
    let newLevel = currentLevel;
    switch (rating) {
      case 'fail': newLevel = 0; break;
      case 'hard': newLevel = Math.max(0, newLevel); break;
      case 'good': newLevel = Math.min(newLevel + 1, SRS_INTERVALS.length - 1); break;
      case 'easy': newLevel = Math.min(newLevel + 2, SRS_INTERVALS.length - 1); break;
    }
    return SRS_INTERVALS[newLevel];
};

export const StudySession: React.FC<StudySessionProps> = ({ words, onComplete, onUpdateWord }) => {
  const [queue, setQueue] = useState<WordData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode | null>(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, forgotten: 0 });
  const [autoRead, setAutoRead] = useState<boolean>(() => {
    return localStorage.getItem('vocab_auto_read') === 'true';
  });

  const [userInput, setUserInput] = useState('');
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState<boolean | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState<PronunciationFeedback | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Ref for auto-focusing the typing input
  const typingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (words.length > 0) setQueue(words);
  }, [words]);

  const currentWord = queue[currentIndex];

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, []);

  const generateQuizOptions = useCallback((correctWord: string) => {
    if (!words || words.length < 2) return [correctWord];
    const distractors = words
        .filter(w => w.word !== correctWord)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.word);
    return [...distractors, correctWord].sort(() => Math.random() - 0.5);
  }, [words]);

  const handleRate = useCallback((rating: 'fail' | 'hard' | 'good' | 'easy') => {
    if (!currentWord) return;
    let newLevel = currentWord.srs_level || 0;
    switch (rating) {
      case 'fail': newLevel = 0; setSessionStats(prev => ({ ...prev, forgotten: prev.forgotten + 1 })); break;
      case 'hard': newLevel = Math.max(0, newLevel); break;
      case 'good': newLevel = Math.min(newLevel + 1, SRS_INTERVALS.length - 1); break;
      case 'easy': newLevel = Math.min(newLevel + 2, SRS_INTERVALS.length - 1); break;
    }
    const days = SRS_INTERVALS[newLevel];
    const nextReviewDate = Date.now() + (days * 24 * 60 * 60 * 1000);
    onUpdateWord({ ...currentWord, srs_level: newLevel, next_review: nextReviewDate });
    setSessionStats(prev => ({ ...prev, reviewed: prev.reviewed + 1 }));
    if (currentIndex < queue.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 200); 
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentWord, currentIndex, queue.length, onUpdateWord]);

  const handleFlip = useCallback(() => {
    if (isRecording || studyMode !== 'flashcard') return; 
    setIsFlipped(!isFlipped);
  }, [isRecording, studyMode, isFlipped]);

  const handleCheckTyping = useCallback((e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!userInput.trim()) return;
      const correct = userInput.trim().toLowerCase() === currentWord.word.toLowerCase();
      setIsCorrectAnswer(correct);
      setIsAnswered(true);
      if (correct) speak(currentWord.word);
  }, [userInput, currentWord, speak]);

  const handleSelectQuiz = useCallback((option: string) => {
      if (isAnswered) return;
      const correct = option === currentWord.word;
      setIsCorrectAnswer(correct);
      setIsAnswered(true);
      if (correct) speak(currentWord.word);
  }, [isAnswered, currentWord, speak]);

  // Study Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // General exit
      if (e.key === 'Escape') onComplete();

      // View switching / Quiz selection
      if (!studyMode) {
        if (e.key === '1') setStudyMode('flashcard');
        if (e.key === '2') setStudyMode('typing');
        if (e.key === '3') setStudyMode('quiz');
        return;
      }

      const isInput = e.target instanceof HTMLInputElement;

      // Card actions
      if (e.key === ' ' && !isInput) {
        e.preventDefault();
        if (studyMode === 'flashcard') handleFlip();
        if (studyMode === 'typing' && !isAnswered) handleCheckTyping();
        return;
      }

      if (e.key.toLowerCase() === 'v') speak(currentWord?.word || '');

      // SRS Ratings (1-4)
      const canRate = (studyMode === 'flashcard' && isFlipped) || (studyMode !== 'flashcard' && isAnswered);
      if (canRate) {
        if (e.key === '1') handleRate('fail');
        if (e.key === '2') handleRate('hard');
        if (e.key === '3') handleRate('good');
        if (e.key === '4') handleRate('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studyMode, handleFlip, handleRate, isFlipped, isAnswered, currentWord, handleCheckTyping, onComplete, speak]);

  useEffect(() => {
    if (currentWord) {
        if (autoRead && studyMode === 'flashcard' && !isFlipped) speak(currentWord.word);
        if (studyMode === 'quiz') setQuizOptions(generateQuizOptions(currentWord.word));
        setUserInput('');
        setIsAnswered(false);
        setIsCorrectAnswer(null);
        setFeedback(null);

        // Auto-focus the input when a new word is loaded in typing mode
        if (studyMode === 'typing') {
          setTimeout(() => {
            typingInputRef.current?.focus();
          }, 50);
        }
    }
  }, [currentIndex, currentWord, studyMode, autoRead, isFlipped, speak, generateQuizOptions]);

  const toggleAutoRead = () => {
    const newState = !autoRead;
    setAutoRead(newState);
    localStorage.setItem('vocab_auto_read', String(newState));
    if (newState && currentWord) speak(currentWord.word);
  };

  const startRecording = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsChecking(true);
          try {
            const result = await checkPronunciation(currentWord.word, base64Audio, 'audio/webm');
            setFeedback(result);
          } catch (err) { console.error(err); } finally { setIsChecking(false); }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setFeedback(null);
      setTimeout(() => { if (recorder.state === 'recording') stopRecording(); }, 3000);
    } catch (err) { alert("Cần quyền Micro."); }
  };

  const stopRecording = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!studyMode && queue.length > 0) {
    return (
        <div className="fixed inset-0 z-[110] bg-gray-950 flex flex-col items-center justify-center p-4">
             <div className="bg-gray-900 border border-gray-700 p-8 rounded-3xl max-w-lg w-full text-center shadow-2xl">
                <div className="bg-emerald-500/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Layers size={40} className="text-emerald-500" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Cài đặt buổi học</h2>
                <p className="text-gray-400 mb-8">Chọn cách ôn tập {queue.length} từ vựng hôm nay.</p>
                <div className="grid grid-cols-1 gap-4 mb-8">
                    <button onClick={() => setStudyMode('flashcard')} className="flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl transition-all group relative">
                        <div className="bg-emerald-500/20 p-3 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform"><RotateCw size={24} /></div>
                        <div className="text-left"><div className="font-bold text-white">Thẻ ghi nhớ</div><div className="text-xs text-gray-500">Tự đánh giá</div></div>
                        <span className="absolute right-4 bg-gray-950 px-1.5 rounded border border-gray-800 text-[10px] text-gray-600 font-bold">1</span>
                    </button>
                    <button onClick={() => setStudyMode('typing')} className="flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl transition-all group relative">
                        <div className="bg-blue-500/20 p-3 rounded-xl text-blue-500 group-hover:scale-110 transition-transform"><Keyboard size={24} /></div>
                        <div className="text-left"><div className="font-bold text-white">Gõ từ vựng</div><div className="text-xs text-gray-500">Thử thách chính xác</div></div>
                        <span className="absolute right-4 bg-gray-950 px-1.5 rounded border border-gray-800 text-[10px] text-gray-600 font-bold">2</span>
                    </button>
                    <button onClick={() => setStudyMode('quiz')} className="flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl transition-all group relative">
                        <div className="bg-purple-500/20 p-3 rounded-xl text-purple-500 group-hover:scale-110 transition-transform"><ListChecks size={24} /></div>
                        <div className="text-left"><div className="font-bold text-white">Trắc nghiệm</div><div className="text-xs text-gray-500">Chọn 1 trong 4</div></div>
                        <span className="absolute right-4 bg-gray-950 px-1.5 rounded border border-gray-800 text-[10px] text-gray-600 font-bold">3</span>
                    </button>
                </div>
                <button onClick={onComplete} className="text-gray-500 hover:text-white text-sm font-medium">Hủy bỏ [Esc]</button>
             </div>
        </div>
    );
  }

  if (queue.length === 0 || currentIndex >= queue.length) {
    const isFinished = currentIndex >= queue.length;
    return (
      <div className="fixed inset-0 z-[110] bg-gray-950 flex flex-col items-center justify-center p-4">
         <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl max-w-md w-full text-center">
            {isFinished ? (
                <><div className="bg-emerald-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} className="text-emerald-500" /></div><h2 className="text-2xl font-bold text-white mb-2">Buổi học kết thúc</h2><div className="grid grid-cols-2 gap-4 mb-8"><div className="bg-gray-800 p-4 rounded-xl"><div className="text-3xl font-bold text-white">{sessionStats.reviewed}</div><div className="text-xs text-gray-500 uppercase font-semibold">Đã ôn</div></div><div className="bg-gray-800 p-4 rounded-xl"><div className="text-3xl font-bold text-red-400">{sessionStats.forgotten}</div><div className="text-xs text-gray-500 uppercase font-semibold">Cần cố gắng</div></div></div></>
            ) : (
                <><div className="bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Brain size={40} className="text-gray-500" /></div><h2 className="text-2xl font-bold text-white mb-2">Không có từ nào</h2></>
            )}
            <button onClick={onComplete} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium w-full">Hoàn tất [Esc]</button>
         </div>
      </div>
    );
  }

  const wordLevel = currentWord?.srs_level || 0;

  return (
    <div className="fixed inset-0 z-[110] bg-gray-950 flex flex-col p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-4">
            <div className="text-gray-400 font-mono text-sm bg-gray-900 px-3 py-1 rounded-full border border-gray-800">{currentIndex + 1} / {queue.length}</div>
            {studyMode === 'flashcard' && (
                <button onClick={toggleAutoRead} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${autoRead ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                    {autoRead ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    <span className="text-xs font-bold uppercase tracking-wider">{autoRead ? 'On' : 'Off'}</span>
                </button>
            )}
        </div>
        <button onClick={onComplete} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors" title="Thoát [Esc]"><X size={24} /></button>
      </div>

      <div className="flex-1 flex items-center justify-center w-full max-w-4xl mx-auto">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-xl perspective-1000 relative">
            {studyMode === 'flashcard' && (
                <div className="relative w-full aspect-[4/5] cursor-pointer group transition-all duration-500 transform-style-3d" style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }} onClick={handleFlip}>
                    <div className="absolute inset-0 backface-hidden bg-gray-900 border-2 border-gray-700 rounded-3xl flex flex-col items-center justify-center p-8 shadow-2xl overflow-hidden">
                        <span className="text-emerald-500 text-sm font-bold tracking-widest uppercase mb-4">English</span>
                        <h2 className="text-5xl sm:text-6xl font-bold text-white text-center mb-6">{currentWord.word}</h2>
                        <div className="flex items-center gap-4">
                            <button onClick={(e) => { e.stopPropagation(); speak(currentWord.word); }} className="p-4 bg-gray-800 hover:bg-gray-700 text-emerald-400 rounded-full border border-gray-700 relative group/btn"><Volume2 size={28} /><span className="absolute -bottom-1 -right-1 text-[8px] bg-gray-950 px-1 rounded border border-gray-800">V</span></button>
                            <button onClick={startRecording} disabled={isChecking} className="p-4 bg-gray-800 text-blue-400 rounded-full border border-gray-700 relative"><Mic size={28} /><span className="absolute -bottom-1 -right-1 text-[8px] bg-gray-950 px-1 rounded border border-gray-800">R</span></button>
                        </div>
                        <p className="absolute bottom-6 text-gray-500 text-sm animate-pulse flex items-center gap-2">[Dấu cách] để lật</p>
                    </div>
                    <div className="absolute inset-0 backface-hidden bg-gray-800 border-2 border-emerald-500/30 rounded-3xl flex flex-col p-8 shadow-2xl overflow-y-auto" style={{ transform: 'rotateY(180deg)' }}>
                        <div className="flex-1 space-y-4 flex flex-col justify-center">
                            <div className="text-center"><h3 className="text-3xl font-bold text-emerald-400 mb-1">{currentWord.meaning_vi}</h3><p className="text-blue-300 italic text-sm">{currentWord.part_of_speech}</p></div>
                            <div className="space-y-2">
                                <div className="bg-gray-900/50 p-3 rounded-xl border-l-4 border-emerald-500"><p className="text-white text-base">{currentWord.example_en}</p></div>
                                <div className="bg-gray-900/50 p-3 rounded-xl border-l-4 border-yellow-500/50"><p className="text-gray-300 text-sm">{currentWord.root_word_mnemonic}</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {studyMode === 'typing' && (
                <div className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-8 shadow-2xl">
                    <div className="text-center mb-8"><h3 className="text-3xl font-bold text-white mb-2">{currentWord.meaning_vi}</h3><p className="text-gray-500 text-sm italic">{currentWord.part_of_speech}</p></div>
                    <form onSubmit={handleCheckTyping} className="relative mb-6">
                        <input 
                          ref={typingInputRef}
                          autoFocus 
                          type="text" 
                          value={userInput} 
                          disabled={isAnswered} 
                          autoComplete="off"
                          onChange={(e) => setUserInput(e.target.value)} 
                          className={`w-full bg-gray-800 text-2xl text-center font-bold text-white p-4 rounded-2xl border-2 transition-all outline-none ${isAnswered ? isCorrectAnswer ? 'border-emerald-500 bg-emerald-500/10' : 'border-red-500 bg-red-500/10' : 'border-gray-700 focus:border-blue-500'}`} 
                          placeholder="Gõ từ..." 
                        />
                        {isAnswered && <div className="text-center mt-4 text-emerald-400 text-xl font-black">{currentWord.word}</div>}
                    </form>
                    {!isAnswered && <button onClick={handleCheckTyping} className="w-full bg-blue-600 py-4 rounded-2xl font-bold">[Space] Kiểm tra</button>}
                </div>
            )}
            {studyMode === 'quiz' && (
                <div className="w-full bg-gray-900 border-2 border-gray-700 rounded-3xl p-8 shadow-2xl">
                    <div className="text-center mb-10"><h3 className="text-3xl font-bold text-white mb-2">{currentWord.meaning_vi}</h3></div>
                    <div className="grid grid-cols-1 gap-3">
                        {quizOptions.map((option, idx) => (
                            <button key={idx} disabled={isAnswered} onClick={() => handleSelectQuiz(option)} className={`w-full p-4 rounded-2xl border-2 font-bold text-lg text-left transition-all ${isAnswered ? option === currentWord.word ? 'bg-emerald-500 border-emerald-400 text-gray-950' : option === userInput ? 'bg-red-500 border-red-400 text-gray-950' : 'bg-gray-800 opacity-50' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}>
                                <span className="mr-3 opacity-40 text-xs">{(idx + 1)}</span> {option}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className={`mt-6 max-w-2xl mx-auto w-full transition-all duration-300 ${(studyMode === 'flashcard' && isFlipped) || (studyMode !== 'flashcard' && isAnswered) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
         <div className="grid grid-cols-4 gap-3">
            <button onClick={() => handleRate('fail')} className="flex flex-col items-center bg-red-900/20 border border-red-500/30 text-red-400 py-3 rounded-xl relative"><span className="font-bold">Quên</span><span className="text-[10px] bg-gray-950 px-1 rounded absolute -top-2 -right-1 border border-red-500/30">1</span></button>
            <button onClick={() => handleRate('hard')} className="flex flex-col items-center bg-orange-900/20 border border-orange-500/30 text-orange-400 py-3 rounded-xl relative"><span className="font-bold">Khó</span><span className="text-[10px] bg-gray-950 px-1 rounded absolute -top-2 -right-1 border border-orange-500/30">2</span></button>
            <button onClick={() => handleRate('good')} className="flex flex-col items-center bg-blue-900/20 border border-blue-500/30 text-blue-400 py-3 rounded-xl relative"><span className="font-bold">Thuộc</span><span className="text-[10px] bg-gray-950 px-1 rounded absolute -top-2 -right-1 border border-blue-500/30">3</span></button>
            <button onClick={() => handleRate('easy')} className="flex flex-col items-center bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 py-3 rounded-xl relative"><span className="font-bold">Dễ</span><span className="text-[10px] bg-gray-950 px-1 rounded absolute -top-2 -right-1 border border-emerald-500/30">4</span></button>
         </div>
      </div>
      <style>{`.perspective-1000 { perspective: 1000px; } .transform-style-3d { transform-style: preserve-3d; } .backface-hidden { backface-visibility: hidden; }`}</style>
    </div>
  );
};
