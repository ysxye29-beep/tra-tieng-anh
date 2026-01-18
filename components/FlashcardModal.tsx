import React from 'react';
import { WordData } from '../types';
import { X, Trash2, BookOpen, PlayCircle } from 'lucide-react';

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  words: WordData[];
  onSelectWord: (word: WordData) => void;
  onRemoveWord: (word: string) => void;
  onStartStudy: () => void;
}

export const FlashcardModal: React.FC<FlashcardModalProps> = ({
  isOpen, onClose, words, onSelectWord, onRemoveWord, onStartStudy
}) => {
  if (!isOpen) return null;

  const now = Date.now();
  const dueWordsCount = words.filter(w => !w.next_review || w.next_review <= now).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 w-full max-w-4xl max-h-[85vh] rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-500">
              <BookOpen size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white leading-none">Kho từ vựng</h2>
              <p className="text-sm text-gray-400 mt-1">Danh sách từ đã lưu của bạn</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-4 bg-gray-800/50 border-b border-gray-800 flex justify-between items-center">
            <div className="flex gap-2">
                <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm font-mono border border-gray-700">Tổng: {words.length}</span>
                <span className="bg-red-900/20 text-red-300 px-3 py-1 rounded-full text-sm font-mono border border-red-900/30">Cần ôn: {dueWordsCount}</span>
            </div>
            
            <button 
                onClick={onStartStudy}
                disabled={dueWordsCount === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-900/20"
            >
                <PlayCircle size={18} />
                Ôn tập ngay
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {words.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4 min-h-[300px]">
              <BookOpen size={64} className="opacity-10" />
              <p className="text-lg font-medium text-gray-400">Chưa có từ nào được lưu</p>
              <p className="text-sm max-w-xs text-center">Hãy bấm biểu tượng Bookmark trên thẻ từ vựng để thêm vào đây.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {words.map((word) => (
                <div 
                  key={word.word} 
                  className="group bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-yellow-500/50 rounded-xl p-4 transition-all duration-200 cursor-pointer relative flex flex-col h-full"
                  onClick={() => onSelectWord(word)}
                >
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors truncate pr-2">{word.word}</h3>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRemoveWord(word.word); }}
                            className="text-gray-500 hover:text-red-400 p-1.5 -mr-1.5 -mt-1.5 rounded-md hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                            title="Xóa từ này"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                    
                    <p className="text-gray-300 text-sm line-clamp-2 mb-3 flex-grow">{word.meaning_vi}</p>
                    
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-700/50">
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                            <span className="bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700 text-yellow-200/70">/{word.ipa}/</span>
                            <span className="italic text-blue-400">{word.part_of_speech}</span>
                        </div>
                        {word.srs_level !== undefined && (
                             <div title="Cấp độ ghi nhớ" className="flex gap-0.5">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (word.srs_level || 0) ? 'bg-emerald-500' : 'bg-gray-700'}`}></div>
                                ))}
                             </div>
                        )}
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};