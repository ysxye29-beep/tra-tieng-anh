
import React, { useState, useMemo } from 'react';
import { WordData, SentenceData } from '../types';
import { Trash2, BookOpen, PlayCircle, Search, Award, Clock, LayoutGrid, List, Eye, EyeOff, Volume2, FileText, FileSpreadsheet, Activity, Flame, ChevronRight, XCircle, CheckCircle2, BookMarked, HelpCircle, MessageSquare, Download, Share2, Cloud, CloudOff, Info, Settings as SettingsIcon, RefreshCw } from 'lucide-react';

interface FlashcardPageProps {
  words: WordData[];
  sentences: SentenceData[];
  onSelectWord: (word: WordData) => void;
  onSelectSentence: (sentence: SentenceData) => void;
  onRemoveWord: (word: string) => void;
  onRemoveSentence: (sentence: string) => void;
  onStartStudy: (type: 'word' | 'sentence' | 'all', mode: 'due' | 'all') => void;
  onBackToSearch: () => void;
  sheetsUrl: string;
  onUpdateSheetsUrl: (url: string) => void;
}

export const FlashcardPage: React.FC<FlashcardPageProps> = ({
  words, sentences, onSelectWord, onSelectSentence, onRemoveWord, onRemoveSentence, onStartStudy, onBackToSearch, sheetsUrl, onUpdateSheetsUrl
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isTestMode, setIsTestMode] = useState(false);
  const [revealedItems, setRevealedItems] = useState<Set<string>>(new Set());
  const [filterLevel, setFilterLevel] = useState<number | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSheetsConfig, setShowSheetsConfig] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const now = Date.now();
  
  const dueWords = useMemo(() => words.filter(w => !w.next_review || w.next_review <= now), [words, now]);
  const dueWordsCount = dueWords.length;

  const dueSentences = useMemo(() => sentences.filter(s => !s.next_review || s.next_review <= now), [sentences, now]);
  const dueSentencesCount = dueSentences.length;

  const totalItemsCount = words.length + sentences.length;

  const srsBuckets = useMemo(() => {
    const buckets = [
      { level: 0, label: '1 ngày', count: 0, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
      { level: 1, label: '3 ngày', count: 0, color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
      { level: 2, label: '7 ngày', count: 0, color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
      { level: 3, label: '14 ngày', count: 0, color: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' },
      { level: 4, label: '30 ngày', count: 0, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
    ];

    [...words, ...sentences].forEach(item => {
      const level = item.srs_level || 0;
      if (level >= 0 && level <= 4) {
        buckets[level].count++;
      } else if (level > 4) {
        buckets[4].count++;
      }
    });

    return buckets;
  }, [words, sentences]);

  const syncAllToSheets = async () => {
    if (!sheetsUrl || isSyncing) return;
    setIsSyncing(true);
    let successCount = 0;
    
    try {
      // Đồng bộ từ vựng
      for (const w of words) {
        await fetch(sheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            type: 'Word',
            word: w.word,
            ipa: w.ipa,
            meaning_vi: w.meaning_vi,
            definition_en: w.definition_en,
            part_of_speech: w.part_of_speech,
            example_en: w.example_en,
            example_vi: w.example_vi,
            example_b2_en: w.example_b2_en,
            example_b2_vi: w.example_b2_vi,
            root_word: w.root_word,
            mnemonic: w.mnemonic,
            synonyms: w.synonyms?.join(', '),
            antonyms: w.antonyms?.join(', '),
            word_family: w.word_family?.join(', '),
            collocations: w.collocations?.join(', ')
          })
        });
        successCount++;
      }
      // Đồng bộ mẫu câu
      for (const s of sentences) {
        await fetch(sheetsUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            type: 'Sentence',
            sentence: s.sentence,
            meaning_vi: s.meaning_vi,
            usage_context: s.usage_context,
            naturalness: s.naturalness_score,
            grammar: s.grammar_breakdown
          })
        });
        successCount++;
      }
      alert(`Đã đồng bộ thành công ${successCount} mục với đầy đủ thông tin lên Google Sheets!`);
    } catch (e) {
      alert("Lỗi khi kết nối với Google Sheets. Vui lòng kiểm tra lại URL.");
    } finally {
      setIsSyncing(false);
    }
  };

  const exportToExcel = () => {
    if (words.length === 0 && sentences.length === 0) return;
    let csvContent = "\uFEFF";
    csvContent += "Type,Word/Sentence,IPA,Part of Speech,Definition (EN),Meaning (VI),Example (EN),Example (VI)\n";
    words.forEach(w => {
      const row = ["Word", `"${w.word}"`, `"/${w.ipa}/"`, `"${w.part_of_speech}"`, `"${w.definition_en}"`, `"${w.meaning_vi}"`, `"${w.example_en}"`, `"${w.example_vi}"`];
      csvContent += row.join(",") + "\n";
    });
    sentences.forEach(s => {
      const row = ["Sentence", `"${s.sentence}"`, "", "", `"${s.usage_context}"`, `"${s.meaning_vi}"`, "", ""];
      csvContent += row.join(",") + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FlashVocab_Export_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const copyToClipboardForWord = () => {
    let text = "TỪ VỰNG / CÂU\tPHIÊN ÂM\tĐỊNH NGHĨA (EN)\tNGHĨA (VI)\tVÍ DỤ\n";
    words.forEach(w => { text += `${w.word}\t/${w.ipa}/\t${w.definition_en}\t${w.meaning_vi}\t${w.example_en}\n`; });
    sentences.forEach(s => { text += `${s.sentence}\t\t${s.usage_context}\t${s.meaning_vi}\t\n`; });
    navigator.clipboard.writeText(text).then(() => {
      alert("Đã sao chép! Bạn có thể dán (Ctrl+V) vào Word.");
      setShowExportMenu(false);
    });
  };

  const getStatusInfo = (item: WordData | SentenceData) => {
    const level = item.srs_level || 0;
    if (level >= 4) return { text: "Thành thạo", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: <CheckCircle2 size={12} /> };
    if (level >= 2) return { text: "Đang nhớ", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: <BookMarked size={12} /> };
    return { text: "Mới học", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: <HelpCircle size={12} /> };
  };

  const toggleReveal = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newRevealed = new Set(revealedItems);
    if (newRevealed.has(id)) newRevealed.delete(id);
    else newRevealed.add(id);
    setRevealedItems(newRevealed);
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gray-900 rounded-3xl p-6 sm:p-8 mb-8 border border-gray-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-8">
            <div className="flex items-center gap-5">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl shadow-lg shadow-emerald-500/20"><BookOpen size={32} className="text-white" /></div>
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Kho lưu trữ</h2>
                    <p className="text-gray-400 mt-1 font-medium">Lộ trình ghi nhớ từ vựng & mẫu câu</p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowSheetsConfig(!showSheetsConfig)}
                      className={`p-3 rounded-2xl border transition-all ${sheetsUrl ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'}`}
                      title="Cấu hình Google Sheets"
                    >
                      <SettingsIcon size={20} />
                    </button>
                    {sheetsUrl && (
                      <button 
                        onClick={syncAllToSheets}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all disabled:opacity-50"
                      >
                        {isSyncing ? <RefreshCw className="animate-spin" size={18} /> : <Cloud size={18} />}
                        Sync All
                      </button>
                    )}
                </div>
                <div className="flex gap-6 px-6 py-3 bg-gray-800/50 rounded-2xl border border-gray-700/50 backdrop-blur-sm">
                    <div className="flex flex-col"><span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Tổng cộng</span><span className="text-2xl font-bold text-white">{totalItemsCount}</span></div>
                    <div className="w-px bg-gray-700"></div>
                    <div className="flex flex-col relative group">
                        <button onClick={() => setShowExportMenu(!showExportMenu)} className="flex items-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors"><Download size={16} /><span className="text-[10px] uppercase font-bold tracking-wider">Xuất danh sách</span></button>
                        {showExportMenu && (
                          <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                             <button onClick={exportToExcel} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-sm text-gray-200 border-b border-gray-700 transition-colors"><FileSpreadsheet size={16} className="text-emerald-500" /> Xuất Excel (.csv)</button>
                             <button onClick={copyToClipboardForWord} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 text-sm text-gray-200 transition-colors"><FileText size={16} className="text-blue-500" /> Chép cho Word/Table</button>
                          </div>
                        )}
                    </div>
                </div>
                <button onClick={() => onStartStudy('all', 'due')} disabled={(dueWordsCount + dueSentencesCount) === 0} className="flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-gray-900 px-8 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-emerald-500/20 active:scale-95 group"><PlayCircle size={22} fill="currentColor" /><span>Ôn tập {(dueWordsCount + dueSentencesCount)} mục</span></button>
            </div>
        </div>

        {/* Sheets Config Panel */}
        {showSheetsConfig && (
          <div className="relative z-10 mb-8 p-6 bg-gray-800/80 rounded-2xl border border-blue-500/30 animate-in slide-in-from-top-4 duration-300">
             <div className="flex items-start gap-4 mb-4">
                <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><Cloud size={20} /></div>
                <div>
                   <h3 className="font-bold text-white">Kết nối Google Sheets</h3>
                   <p className="text-xs text-gray-400 mt-0.5">Dán Apps Script Web App URL để lưu từ vựng lên bảng tính của bạn.</p>
                </div>
             </div>
             <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  value={sheetsUrl} 
                  onChange={(e) => onUpdateSheetsUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-2 text-sm text-emerald-400 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-all"
                />
                <button onClick={() => setShowSheetsConfig(false)} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-bold text-white transition-colors">Lưu lại</button>
             </div>
             <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500 italic"><Info size={12} /> Dùng Apps Script `doPost` để nhận JSON.</div>
          </div>
        )}

        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6 border-t border-gray-800/50">
          {srsBuckets.map((bucket, i) => (
            <button key={i} onClick={() => setFilterLevel(filterLevel === bucket.level ? null : bucket.level)} className={`flex flex-col items-center p-3 rounded-2xl border transition-all relative overflow-hidden group ${filterLevel === bucket.level ? `${bucket.bg} ${bucket.border} shadow-lg ring-1 ring-white/10 scale-[1.02]` : 'bg-gray-800/30 border-gray-800/50 hover:border-gray-700'}`}>
              <span className={`text-[10px] font-black uppercase tracking-widest mb-1 relative z-10 ${bucket.color}`}>{bucket.label}</span>
              <div className="flex items-center gap-2 relative z-10"><span className="text-xl font-bold text-white">{bucket.count}</span><div className={`w-1.5 h-1.5 rounded-full ${bucket.color.replace('text', 'bg')}`}></div></div>
            </button>
          ))}
        </div>
      </div>

      {dueWordsCount > 0 && filterLevel === null && (
        <div className="mb-12 animate-in fade-in slide-in-from-left duration-700">
           <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2"><div className="bg-orange-500 p-1.5 rounded-lg text-white shadow-lg shadow-orange-500/20"><Flame size={20} /></div><h2 className="text-2xl font-black text-white uppercase tracking-tight">Từ vựng cần ôn hôm nay</h2></div>
              <button onClick={() => onStartStudy('word', 'due')} className="text-sm font-bold text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors">Ôn ngay <ChevronRight size={16} /></button>
           </div>
           <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
              {dueWords.map((word) => (
                <div key={word.word} onClick={() => onSelectWord(word)} className="snap-start min-w-[240px] bg-gray-900 border-2 border-orange-500/20 hover:border-orange-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:-translate-y-1 shadow-xl relative overflow-hidden group">
                  <h4 className="text-xl font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">{word.word}</h4>
                  <p className="text-sm text-gray-400 line-clamp-1 mb-3">{word.meaning_vi}</p>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-800/50">
                    <span className="text-[10px] font-mono text-gray-500 bg-gray-950 px-2 py-0.5 rounded border border-gray-800">/{word.ipa}/</span>
                    <div className="flex gap-0.5">{[...Array(5)].map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i < (word.srs_level || 0) ? 'bg-orange-500' : 'bg-gray-800'}`}></div>))}</div>
                  </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {dueSentencesCount > 0 && filterLevel === null && (
        <div className="mb-12 animate-in fade-in slide-in-from-right duration-700">
           <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2"><div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-blue-600/20"><MessageSquare size={20} /></div><h2 className="text-2xl font-black text-white uppercase tracking-tight">Mẫu câu cần ôn hôm nay</h2></div>
              <button onClick={() => onStartStudy('sentence', 'due')} className="text-sm font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">Ôn ngay <ChevronRight size={16} /></button>
           </div>
           <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x">
              {dueSentences.map((s) => (
                <div key={s.sentence} onClick={() => onSelectSentence(s)} className="snap-start min-w-[280px] bg-gray-900 border-2 border-blue-500/20 hover:border-blue-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:-translate-y-1 shadow-xl relative group">
                  <h4 className="text-lg font-bold text-white mb-1 line-clamp-1 group-hover:text-blue-400 transition-colors">{s.sentence}</h4>
                  <p className="text-sm text-gray-400 line-clamp-1 mb-3">{s.meaning_vi}</p>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-800/50">
                    <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{s.naturalness_score}% Natural</span>
                    <div className="flex gap-0.5">{[...Array(5)].map((_, i) => (<div key={i} className={`w-1 h-1 rounded-full ${i < (s.srs_level || 0) ? 'bg-blue-500' : 'bg-gray-800'}`}></div>))}</div>
                  </div>
                </div>
              ))}
           </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
              <div className="flex flex-col">
                  <h2 className="text-2xl font-bold text-white px-2">{filterLevel === null ? 'Tất cả danh sách' : `Đang lọc: Buổi ôn tập ${srsBuckets.find(b => b.level === filterLevel)?.label}`}</h2>
                  {filterLevel !== null && (<button onClick={() => setFilterLevel(null)} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 px-2 mt-1 transition-colors font-medium"><XCircle size={12} /> Bỏ lọc hiển thị</button>)}
              </div>
              <button onClick={() => setIsTestMode(!isTestMode)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-xs uppercase tracking-widest ${isTestMode ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300'}`}>{isTestMode ? <EyeOff size={16} /> : <Eye size={16} />}<span className="hidden sm:inline">{isTestMode ? 'Đang ẩn nghĩa' : 'Kiểm tra trí nhớ'}</span></button>
          </div>
          <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-800 shadow-sm"><button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-800 text-emerald-400' : 'text-gray-500'}`}><List size={20} /></button><button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-800 text-emerald-400' : 'text-gray-500'}`}><LayoutGrid size={20} /></button></div>
      </div>

      <div className="space-y-12">
          {words.length > 0 && (
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2 text-gray-500 uppercase text-[10px] font-black tracking-[0.2em] mb-2"><BookOpen size={14} /> TỪ VỰNG ({words.filter(w => filterLevel === null || (filterLevel === 4 ? (w.srs_level||0) >= 4 : (w.srs_level||0) === filterLevel)).length})</div>
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" : "flex flex-col gap-3"}>
                    {words.filter(w => filterLevel === null || (filterLevel === 4 ? (w.srs_level||0) >= 4 : (w.srs_level||0) === filterLevel)).map((word) => {
                            const isMastered = (word.srs_level || 0) >= 4;
                            const shouldBlur = isTestMode && !revealedItems.has(word.word);
                            const status = getStatusInfo(word);
                            return (viewMode === 'list' ? (
                                <div key={word.word} onClick={() => onSelectWord(word)} className={`group flex flex-col sm:flex-row sm:items-stretch bg-gray-900/80 hover:bg-gray-800/80 border ${isMastered ? 'border-emerald-900/40' : 'border-gray-800'} hover:border-gray-700 p-4 rounded-2xl transition-all cursor-pointer shadow-sm relative overflow-hidden`}>
                                    <div className="flex-1 flex items-center min-w-0 sm:max-w-[220px]">
                                        <div className="flex-1 min-w-0 pr-4"><h3 className={`text-xl font-bold truncate ${isMastered ? 'text-emerald-400' : 'text-white'}`}>{word.word}</h3><div className="flex items-center gap-2 mt-0.5"><span className="text-[10px] font-mono text-gray-600">/{word.ipa}/</span><div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tight ${status.bg} ${status.color} ${status.border}`}>{status.icon} {status.text}</div></div></div>
                                        <div className="hidden sm:block w-px bg-gray-800 h-10 my-auto"></div>
                                    </div>
                                    <div className="flex-[3] min-w-0 relative sm:px-6 flex flex-col justify-center py-2 sm:py-0">
                                        {shouldBlur && (<div onClick={(e) => toggleReveal(e, word.word)} className="absolute inset-0 z-10 bg-gray-900/40 backdrop-blur-md flex items-center justify-center cursor-help rounded-lg group-hover:bg-gray-900/20 transition-all"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity">Nhấp để xem nghĩa</span></div>)}
                                        <div className={`transition-all duration-300 ${shouldBlur ? 'blur-sm select-none opacity-20' : 'blur-0 opacity-100'}`}><div className="text-sm text-emerald-400/90 font-bold truncate mb-1">{word.meaning_vi}</div><div className="text-xs space-y-0.5"><p className="text-gray-400 italic line-clamp-1">"{word.example_en}"</p><p className="text-gray-600 line-clamp-1">→ {word.example_vi}</p></div></div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end sm:pl-4"><div className="flex items-center gap-1"><button onClick={(e) => { e.stopPropagation(); onRemoveWord(word.word); }} className="p-2 text-gray-600 hover:text-red-400 hover:bg-gray-700/50 rounded-lg transition-all"><Trash2 size={18} /></button></div></div>
                                </div>
                            ) : (
                                <div key={word.word} className={`group bg-gray-900 hover:bg-gray-800 border ${isMastered ? 'border-emerald-900/50 hover:border-emerald-500/30' : 'border-gray-800 hover:border-gray-600'} rounded-2xl p-5 transition-all duration-300 cursor-pointer relative flex flex-col h-full`} onClick={() => onSelectWord(word)}>
                                    <div className="flex justify-between items-start mb-3"><h3 className={`text-xl font-bold transition-colors truncate pr-2 ${isMastered ? 'text-emerald-400' : 'text-white'}`}>{word.word}</h3><div className="flex items-center gap-2"><button onClick={(e) => { e.stopPropagation(); onRemoveWord(word.word); }} className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button></div></div>
                                    <p className="text-gray-400 text-sm line-clamp-2 mb-4 flex-grow font-medium">{word.meaning_vi}</p>
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-800"><div className="flex items-center gap-2"><span className="text-xs font-mono text-gray-500 bg-gray-950 px-2 py-1 rounded border border-gray-800">/{word.ipa}/</span></div><div className="flex gap-1">{[...Array(5)].map((_, i) => (<div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (word.srs_level || 0) ? 'bg-emerald-500' : 'bg-gray-800'}`}></div>))}</div></div>
                                </div>
                            ));
                        })}
                </div>
            </div>
          )}

          {sentences.length > 0 && (
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2 text-gray-500 uppercase text-[10px] font-black tracking-[0.2em] mb-2"><MessageSquare size={14} /> MẪU CÂU ({sentences.filter(s => filterLevel === null || (filterLevel === 4 ? (s.srs_level||0) >= 4 : (s.srs_level||0) === filterLevel)).length})</div>
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-5" : "flex flex-col gap-3"}>
                    {sentences.filter(s => filterLevel === null || (filterLevel === 4 ? (s.srs_level||0) >= 4 : (s.srs_level||0) === filterLevel)).map((s) => {
                            const isMastered = (s.srs_level || 0) >= 4;
                            const shouldBlur = isTestMode && !revealedItems.has(s.sentence);
                            const status = getStatusInfo(s);
                            return (viewMode === 'list' ? (
                                <div key={s.sentence} onClick={() => onSelectSentence(s)} className={`group flex flex-col sm:flex-row sm:items-stretch bg-gray-900/80 hover:bg-gray-800/80 border ${isMastered ? 'border-emerald-900/40' : 'border-gray-800'} hover:border-gray-700 p-5 rounded-2xl transition-all cursor-pointer shadow-sm relative overflow-hidden`}>
                                    <div className="flex-1 flex items-center min-w-0 sm:max-w-[300px]"><div className="flex-1 min-w-0 pr-4"><h3 className={`text-lg font-bold truncate ${isMastered ? 'text-emerald-400' : 'text-white'}`}>{s.sentence}</h3><div className="flex items-center gap-2 mt-0.5"><div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-tight ${status.bg} ${status.color} ${status.border}`}>{status.icon} {status.text}</div><span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{s.naturalness_score}% Natural</span></div></div><div className="hidden sm:block w-px bg-gray-800 h-10 my-auto"></div></div>
                                    <div className="flex-[3] min-w-0 relative sm:px-6 flex flex-col justify-center py-2 sm:py-0">
                                        {shouldBlur && (<div onClick={(e) => toggleReveal(e, s.sentence)} className="absolute inset-0 z-10 bg-gray-900/40 backdrop-blur-md flex items-center justify-center cursor-help rounded-lg group-hover:bg-gray-900/20 transition-all"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 opacity-40 group-hover:opacity-100 transition-opacity">Nhấp để xem nghĩa</span></div>)}
                                        <div className={`transition-all duration-300 ${shouldBlur ? 'blur-sm select-none opacity-20' : 'blur-0 opacity-100'}`}><div className="text-sm text-emerald-400/90 font-bold truncate mb-1">{s.meaning_vi}</div><div className="text-[10px] text-gray-500 line-clamp-1 italic">{s.usage_context}</div></div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end sm:pl-4"><div className="flex items-center gap-1"><button onClick={(e) => { e.stopPropagation(); onRemoveSentence(s.sentence); }} className="p-2 text-gray-600 hover:text-red-400 hover:bg-gray-700/50 rounded-lg transition-all"><Trash2 size={18} /></button></div></div>
                                </div>
                            ) : (
                                <div key={s.sentence} className={`group bg-gray-900 hover:bg-gray-800 border ${isMastered ? 'border-emerald-900/50 hover:border-emerald-500/30' : 'border-gray-800 hover:border-gray-600'} rounded-2xl p-5 transition-all duration-300 cursor-pointer relative flex flex-col h-full`} onClick={() => onSelectSentence(s)}>
                                    <div className="flex justify-between items-start mb-3"><h3 className={`text-lg font-bold transition-colors truncate pr-2 ${isMastered ? 'text-emerald-400' : 'text-white'}`}>{s.sentence}</h3><div className="flex items-center gap-2"><button onClick={(e) => { e.stopPropagation(); onRemoveSentence(s.sentence); }} className="text-gray-600 hover:text-red-400 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button></div></div>
                                    <p className="text-gray-400 text-sm line-clamp-2 mb-4 flex-grow font-medium">{s.meaning_vi}</p>
                                    <div className="flex i
