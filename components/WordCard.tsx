
import React, { useState, useRef, useEffect } from 'react';
import { WordData, PronunciationFeedback, SentenceEvaluation } from '../types';
// Added ArrowRight to imports to fix the "Cannot find name 'ArrowRight'" error
import { Volume2, Bookmark, Mic, MicOff, RefreshCw, Star, AlertTriangle, Book, Cloud, PenTool, CheckCircle2, Info, XCircle, Send, ArrowRight } from 'lucide-react';
import { checkPronunciation, evaluateSentence } from '../services/geminiService';

interface WordCardProps {
  data: WordData;
  isSaved: boolean;
  onToggleSave: () => void;
  sheetsUrl?: string;
  onLookup?: (word: string) => void;
}

const ClickableText: React.FC<{ text: string, className?: string, onLookup?: (word: string) => void }> = ({ text, className, onLookup }) => {
  if (!onLookup) return <span className={className}>{text}</span>;
  const parts = text.split(/(\s+)/);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (/\s+/.test(part)) return part;
        const cleanWord = part.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        if (!cleanWord || cleanWord.length < 2) return part;
        return (
          <span key={i} onClick={(e) => { e.stopPropagation(); onLookup(cleanWord); }} className="hover:underline hover:text-emerald-400 cursor-pointer decoration-emerald-500/50 underline-offset-2 transition-colors">
            {part}
          </span>
        );
      })}
    </span>
  );
};

export const WordCard: React.FC<WordCardProps> = ({ data, isSaved, onToggleSave, sheetsUrl, onLookup }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [practiceInput, setPracticeInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<SentenceEvaluation | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const practiceTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus ô nhập liệu khi mở chế độ luyện tập
  useEffect(() => {
    if (showPractice) {
      setTimeout(() => practiceTextareaRef.current?.focus(), 150);
    }
  }, [showPractice]);

  // Phím tắt nội bộ Alt+P
  useEffect(() => {
    const handleLocalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowPractice(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleLocalKeyDown);
    return () => window.removeEventListener('keydown', handleLocalKeyDown);
  }, []);

  const syncToSheets = async () => {
    if (!sheetsUrl || isSyncing) return;
    setIsSyncing(true);
    try {
      await fetch(sheetsUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: 'Word', ...data }) });
      alert(`Đã đồng bộ lên Google Sheets thành công!`);
    } catch (e) { alert("Lỗi kết nối Google Sheets."); } finally { setIsSyncing(false); }
  };

  const handleEvaluate = async () => {
    if (!practiceInput.trim() || isEvaluating) return;
    setIsEvaluating(true);
    setEvaluation(null);
    try {
      const result = await evaluateSentence(data.word, practiceInput);
      setEvaluation(result);
    } catch (err) {
      alert("Lỗi khi đánh giá câu. Vui lòng thử lại.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handlePracticeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEvaluate();
    }
  };

  const playAudio = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(data.word);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const startRecording = async () => {
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
          try { await checkPronunciation(data.word, base64Audio, 'audio/webm'); } 
          catch (err) { console.error(err); } finally { setIsChecking(false); }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
      setTimeout(() => { if (recorder.state === 'recording') stopRecording(); }, 3000);
    } catch (err) { alert("Vui lòng cấp quyền micro để luyện phát âm."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-gray-800/95 sm:rounded-2xl shadow-2xl border border-gray-700/80 overflow-hidden w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Header Section */}
      <div className="bg-gray-750 p-4 sm:p-5 border-b border-gray-700 flex justify-between items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">{data.word}</h1>
            <span className="text-[10px] font-mono text-yellow-300 bg-gray-950 px-2 py-0.5 rounded-lg border border-gray-700">/{data.ipa}/</span>
          </div>
          <p className="text-lg sm:text-xl text-emerald-400 font-bold leading-none">{data.meaning_vi}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setShowPractice(!showPractice)} className={`group relative p-2 rounded-xl border transition-all ${showPractice ? 'bg-purple-500/20 border-purple-500/40 text-purple-400 shadow-lg shadow-purple-500/5' : 'bg-gray-700/50 border-transparent text-gray-500 hover:text-white'}`} title="Luyện đặt câu (Alt+P)">
                <PenTool size={20} />
                <span className="absolute -bottom-1 -right-1 bg-gray-950 border border-gray-700 text-[6px] font-black text-gray-500 px-1 rounded opacity-0 group-hover:opacity-100">Alt+P</span>
            </button>
            {sheetsUrl && (
              <button onClick={syncToSheets} className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/10 active:scale-95 transition-all hover:bg-blue-500/20">
                {isSyncing ? <RefreshCw size={20} className="animate-spin" /> : <Cloud size={20} />}
              </button>
            )}
            <button onClick={onToggleSave} className={`p-2 rounded-xl border active:scale-95 transition-all ${isSaved ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-gray-700/50 border-transparent text-gray-500 hover:text-white'}`}>
              <Bookmark size={20} className={isSaved ? "fill-current" : ""} />
            </button>
            <button onClick={playAudio} className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl active:scale-95 transition-all hover:bg-emerald-500/20">
              <Volume2 size={20} />
            </button>
            <button onClick={isRecording ? stopRecording : startRecording} className={`p-2 rounded-xl border active:scale-95 transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse border-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20'}`}>
              {isChecking ? <RefreshCw size={20} className="animate-spin" /> : isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Practice Panel */}
        {showPractice && (
          <div className="bg-purple-900/10 border border-purple-500/20 rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-4 duration-500 shadow-inner">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                   <PenTool size={18} className="text-purple-400" />
                   <span className="text-xs font-black uppercase text-purple-400 tracking-widest">Luyện đặt câu với "{data.word}"</span>
                </div>
                <div className="flex items-center gap-1.5 bg-gray-950 px-2 py-1 rounded-lg border border-gray-800">
                  <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Phím tắt:</span>
                  <span className="text-[8px] font-black text-purple-400">ENTER để chấm điểm</span>
                </div>
             </div>
             <div className="relative group/input">
                <textarea 
                  ref={practiceTextareaRef}
                  value={practiceInput}
                  onKeyDown={handlePracticeKeyDown}
                  onChange={(e) => setPracticeInput(e.target.value)}
                  placeholder="Viết một câu tiếng Anh có chứa từ này để AI chấm điểm lỗi sai..."
                  className="w-full bg-gray-950/80 border border-gray-800 rounded-xl p-4 text-sm text-white outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/5 min-h-[100px] resize-none transition-all placeholder:text-gray-700"
                />
                <button 
                  onClick={handleEvaluate}
                  disabled={!practiceInput.trim() || isEvaluating}
                  className="absolute right-3 bottom-3 flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-xl text-xs font-black uppercase transition-all shadow-xl active:scale-95 group"
                >
                  {isEvaluating ? <RefreshCw size={14} className="animate-spin" /> : (
                    <>
                      <span>Chấm điểm</span>
                      <Send size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
             </div>

             {evaluation && (
               <div className="bg-gray-950/40 border border-purple-500/20 rounded-2xl p-5 space-y-4 animate-in fade-in duration-500 shadow-xl">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                     <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${evaluation.score >= 80 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {evaluation.score >= 80 ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                        </div>
                        <div>
                          <span className={`text-xl font-black ${evaluation.score >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{evaluation.score}/100</span>
                          <p className="text-[8px] font-black uppercase tracking-widest text-gray-600">Điểm số chuẩn AI</p>
                        </div>
                     </div>
                     <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${evaluation.is_natural ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500' : 'bg-purple-500/5 border-purple-500/10 text-purple-400'}`}>
                       {evaluation.is_natural ? "Native Level" : "Can Improve"}
                     </span>
                  </div>
                  <div className="space-y-1.5">
                     <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><ArrowRight size={10} /> Phiên bản đề xuất</span>
                     <p className="text-sm text-white font-bold leading-relaxed bg-gray-800/30 p-3 rounded-xl border border-gray-700/50">{evaluation.corrected_sentence}</p>
                  </div>
                  <div className="space-y-1.5">
                     <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Info size={10} /> Phân tích lỗi & Gợi ý</span>
                     <p className="text-[11px] text-gray-400 italic leading-relaxed pl-2 border-l-2 border-purple-500/30">{evaluation.explanation_vi}</p>
                  </div>
               </div>
             )}
          </div>
        )}

        {/* Definition Anh-Anh - Compact */}
        <div className="bg-gray-900/60 p-3.5 rounded-xl border border-gray-700/50 shadow-sm">
           <ClickableText text={`"${data.definition_en}"`} onLookup={onLookup} className="text-xs sm:text-sm text-gray-400 italic font-medium leading-relaxed block" />
        </div>

        {/* Thông tin cấu trúc từ - Grid Compact */}
        <div className="grid grid-cols-2 gap-3">
           <div className="flex flex-col gap-1 bg-gray-900/40 p-3 rounded-xl border border-gray-800/50">
             <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em]">Cấu trúc từ</span>
             <span className="text-xs font-bold text-gray-200">{data.syllables}</span>
           </div>
           <div className="flex flex-col gap-1 bg-gray-900/40 p-3 rounded-xl border border-gray-800/50">
             <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em]">Từ loại</span>
             <span className="text-xs italic text-blue-400 font-bold">{data.part_of_speech}</span>
           </div>
        </div>

        {/* Spelling Tip - If exists */}
        {data.spelling_tip && (
          <div className="text-[10px] sm:text-xs text-amber-300 italic bg-amber-950/20 p-3 rounded-xl border border-amber-500/20 leading-relaxed flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <ClickableText text={data.spelling_tip} onLookup={onLookup} />
          </div>
        )}

        {/* Ví dụ thông minh */}
        <div className="space-y-3">
          <div className="bg-gray-900/80 p-4 rounded-2xl border-l-4 border-emerald-500/60 shadow-lg group/ex transition-all hover:bg-gray-900">
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.25em] mb-1.5 block">Ví dụ (Trình độ B1)</span>
            <ClickableText text={data.example_en} onLookup={onLookup} className="text-sm sm:text-base text-white font-bold block leading-relaxed mb-1.5 group-hover/ex:text-emerald-300 transition-colors" />
            <p className="text-gray-400 text-xs sm:text-sm font-medium">→ {data.example_vi}</p>
          </div>
          <div className="bg-gray-900/80 p-4 rounded-2xl border-l-4 border-blue-500/60 shadow-lg group/ex transition-all hover:bg-gray-900">
            <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.25em] mb-1.5 block">Ví dụ (Trình độ B2+)</span>
            <ClickableText text={data.example_b2_en} onLookup={onLookup} className="text-sm sm:text-base text-white font-bold block leading-relaxed mb-1.5 group-hover/ex:text-blue-300 transition-colors" />
            <p className="text-gray-400 text-xs sm:text-sm font-medium">→ {data.example_b2_vi}</p>
          </div>
        </div>

        {/* Từ gốc & Ghi nhớ - Side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-850 p-3 rounded-xl border border-gray-700/50 shadow-sm">
            <span className="text-[8px] text-gray-500 font-black uppercase mb-1.5 block tracking-widest">Gốc từ / Root</span>
            <ClickableText text={data.root_word} onLookup={onLookup} className="text-xs text-emerald-400 font-black" />
          </div>
          <div className="bg-gray-850 p-3 rounded-xl border border-gray-700/50 shadow-sm">
            <span className="text-[8px] text-gray-500 font-black uppercase mb-1.5 block tracking-widest">Mẹo nhớ / Mnemonic</span>
            <ClickableText text={data.mnemonic} onLookup={onLookup} className="text-[10px] text-gray-300 leading-tight italic line-clamp-2" />
          </div>
        </div>

        {/* Related Lists */}
        <div className="pt-2 space-y-4">
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] border-b border-emerald-500/10 pb-1 w-fit">Từ đồng nghĩa</span>
            <div className="flex flex-wrap gap-1.5">
              {data.synonyms.map((s, idx) => (
                <button key={idx} onClick={() => onLookup?.(s.replace(/[.,]/g, "").trim())} className="px-2.5 py-1 bg-gray-950 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-400 hover:bg-emerald-500 hover:text-gray-950 transition-all font-bold shadow-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em] border-b border-red-500/10 pb-1 w-fit">Từ trái nghĩa</span>
            <div className="flex flex-wrap gap-1.5">
              {data.antonyms.length > 0 ? data.antonyms.map((s, idx) => (
                <button key={idx} onClick={() => onLookup?.(s.replace(/[.,]/g, "").trim())} className="px-2.5 py-1 bg-gray-950 border border-red-500/20 rounded-lg text-[10px] text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold shadow-sm">
                  {s}
                </button>
              )) : <span className="text-[10px] text-gray-700 italic px-2">N/A</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-800">
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Họ hàng từ</span>
              <div className="flex flex-wrap gap-1.5">
                {data.word_family.slice(0, 5).map((s, idx) => (
                  <button key={idx} onClick={() => onLookup?.(s.replace(/[.,]/g, "").trim())} className="px-2 py-0.5 bg-gray-950 border border-gray-800 rounded-lg text-[10px] text-gray-500 hover:text-white hover:border-gray-600 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em]">Collocations</span>
              <div className="flex flex-wrap gap-2">
                {data.collocations.slice(0, 3).map((s, idx) => (
                  <span key={idx} className="text-[10px] text-purple-300 font-bold bg-purple-950/20 px-2.5 py-1 rounded-lg border border-purple-500/20 whitespace-nowrap overflow-hidden text-ellipsis max-w-full shadow-inner">
                    {s.split(' ').map((word, wIdx) => <span key={wIdx} onClick={() => onLookup?.(word.replace(/[.,]/g, "").trim())} className="hover:underline cursor-pointer">{word} </span>)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
