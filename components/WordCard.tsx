
import React, { useState, useRef, useEffect } from 'react';
import { WordData, PronunciationFeedback } from '../types';
import { Volume2, Bookmark, Mic, MicOff, RefreshCw, Star, AlertTriangle, Book, Cloud } from 'lucide-react';
import { checkPronunciation } from '../services/geminiService';

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const syncToSheets = async () => {
    if (!sheetsUrl || isSyncing) return;
    setIsSyncing(true);
    try {
      await fetch(sheetsUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ type: 'Word', ...data }) });
      alert(`Đã đồng bộ!`);
    } catch (e) { alert("Lỗi."); } finally { setIsSyncing(false); }
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
    } catch (err) { alert("Micro!"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-gray-800/95 sm:rounded-2xl shadow-xl border border-gray-700/80 overflow-hidden w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header Compact */}
      <div className="bg-gray-750 p-3 sm:p-4 border-b border-gray-700 flex justify-between items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">{data.word}</h1>
            <span className="text-[8px] font-mono text-yellow-300 bg-gray-950 px-1 py-0.5 rounded border border-gray-700">/{data.ipa}/</span>
          </div>
          <p className="text-base sm:text-lg text-emerald-400 font-bold mt-0.5 truncate leading-none">{data.meaning_vi}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
            {sheetsUrl && <button onClick={syncToSheets} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/10 active:scale-95 transition-all">{isSyncing ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}</button>}
            <button onClick={onToggleSave} className={`p-1.5 rounded-lg border active:scale-95 transition-all ${isSaved ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-gray-700/50 border-transparent text-gray-500'}`}><Bookmark size={16} className={isSaved ? "fill-current" : ""} /></button>
            <button onClick={playAudio} className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg active:scale-95 transition-all"><Volume2 size={16} /></button>
            <button onClick={isRecording ? stopRecording : startRecording} className={`p-1.5 rounded-lg border active:scale-95 transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse border-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>{isChecking ? <RefreshCw size={16} className="animate-spin" /> : isRecording ? <MicOff size={16} /> : <Mic size={16} />}</button>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Definition Anh-Anh - Compact */}
        <div className="bg-gray-900/40 p-2.5 rounded-lg border border-gray-700/50">
           <ClickableText text={`"${data.definition_en}"`} onLookup={onLookup} className="text-[11px] sm:text-xs text-gray-400 italic font-medium leading-tight block" />
        </div>

        {/* Thông tin cấu trúc từ - Grid Compact */}
        <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
           <div className="flex flex-col gap-0.5 bg-gray-900/20 p-2 rounded-lg border border-gray-700/30">
             <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">Tách từ</span>
             <span className="font-bold text-gray-200">{data.syllables}</span>
           </div>
           <div className="flex flex-col gap-0.5 bg-gray-900/20 p-2 rounded-lg border border-gray-700/30">
             <span className="text-[7px] font-black text-gray-600 uppercase tracking-widest">Loại từ</span>
             <span className="italic text-blue-400 font-bold">{data.part_of_speech}</span>
           </div>
        </div>

        {/* Spelling Tip - If exists */}
        {data.spelling_tip && (
          <div className="text-[9px] sm:text-[10px] text-amber-300 italic bg-amber-950/10 p-2 rounded-lg border border-amber-500/10 leading-tight">
            <ClickableText text={data.spelling_tip} onLookup={onLookup} />
          </div>
        )}

        {/* Ví dụ thông minh - Shrink padding */}
        <div className="space-y-2">
          <div className="bg-gray-900/50 p-2.5 rounded-lg border-l-2 border-emerald-500/60 shadow-md">
            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest mb-0.5 block">Ví dụ (B1)</span>
            <ClickableText text={data.example_en} onLookup={onLookup} className="text-xs sm:text-sm text-white font-bold block leading-tight mb-0.5" />
            <p className="text-gray-400 text-[10px] sm:text-[11px] font-medium leading-none">→ {data.example_vi}</p>
          </div>
          <div className="bg-gray-900/50 p-2.5 rounded-lg border-l-2 border-blue-500/60 shadow-md">
            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest mb-0.5 block">Ví dụ (B2)</span>
            <ClickableText text={data.example_b2_en} onLookup={onLookup} className="text-xs sm:text-sm text-white font-bold block leading-tight mb-0.5" />
            <p className="text-gray-400 text-[10px] sm:text-[11px] font-medium leading-none">→ {data.example_b2_vi}</p>
          </div>
        </div>

        {/* Từ gốc & Ghi nhớ - Side by side */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-750/30 p-2 rounded-lg border border-gray-700">
            <span className="text-[7px] text-gray-500 font-black uppercase mb-0.5 block tracking-wider">Từ gốc</span>
            <ClickableText text={data.root_word} onLookup={onLookup} className="text-[10px] text-emerald-400 font-extrabold leading-none" />
          </div>
          <div className="bg-gray-750/30 p-2 rounded-lg border border-gray-700">
            <span className="text-[7px] text-gray-500 font-black uppercase mb-0.5 block tracking-wider">Mẹo nhớ</span>
            <ClickableText text={data.mnemonic} onLookup={onLookup} className="text-[9px] text-gray-300 leading-tight italic line-clamp-2" />
          </div>
        </div>

        {/* Related Lists - Clearer labeling and colors */}
        <div className="pt-1 space-y-2">
          <div className="flex flex-col gap-1">
            <span className="text-[7px] font-black text-emerald-500 uppercase tracking-[0.2em] border-b border-emerald-500/10 pb-0.5 w-fit">Đồng nghĩa</span>
            <div className="flex flex-wrap gap-1">
              {data.synonyms.map((s, idx) => (
                <button key={idx} onClick={() => onLookup?.(s.replace(/[.,]/g, "").trim())} className="px-1.5 py-0.5 bg-gray-900 border border-emerald-500/20 rounded text-[9px] text-emerald-400 hover:bg-emerald-500 hover:text-gray-950 transition-all font-bold">
                  {s}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            <span className="text-[7px] font-black text-red-400 uppercase tracking-[0.2em] border-b border-red-500/10 pb-0.5 w-fit">Trái nghĩa</span>
            <div className="flex flex-wrap gap-1">
              {data.antonyms.length > 0 ? data.antonyms.map((s, idx) => (
                <button key={idx} onClick={() => onLookup?.(s.replace(/[.,]/g, "").trim())} className="px-1.5 py-0.5 bg-gray-900 border border-red-500/20 rounded text-[9px] text-red-400 hover:bg-red-500 hover:text-white transition-all font-bold">
                  {s}
                </button>
              )) : <span className="text-[8px] text-gray-700 italic px-1">N/A</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[7px] font-black text-gray-600 uppercase tracking-[0.1em]">Họ từ</span>
              <div className="flex flex-wrap gap-1">
                {data.word_family.slice(0, 4).map((s, idx) => (
                  <button key={idx} onClick={() => onLookup?.(s.replace(/[.,]/g, "").trim())} className="px-1.5 py-0.5 bg-gray-950 border border-gray-700 rounded text-[9px] text-gray-400">
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[7px] font-black text-purple-400 uppercase tracking-[0.1em]">Collocations</span>
              <div className="flex flex-wrap gap-1">
                {data.collocations.slice(0, 2).map((s, idx) => (
                  <span key={idx} className="text-[9px] text-purple-300 font-bold bg-purple-950/20 px-1.5 py-0.5 rounded border border-purple-500/10 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                    {s.split(' ').map((word, wIdx) => <span key={wIdx} onClick={() => onLookup?.(word.replace(/[.,]/g, "").trim())} className="hover:underline">{word} </span>)}
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
