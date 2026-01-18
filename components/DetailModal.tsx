
import React, { useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { WordData, SentenceData } from '../types';
import { WordCard } from './WordCard';
import { SentenceCard } from './SentenceCard';

interface DetailModalProps {
  item: WordData | SentenceData | null;
  onClose: () => void;
  sheetsUrl?: string;
  isSaved: boolean;
  onToggleSave: () => void;
  onLookup?: (word: string) => void;
  isLoading?: boolean;
}

export const DetailModal: React.FC<DetailModalProps> = ({ item, onClose, sheetsUrl, isSaved, onToggleSave, onLookup, isLoading }) => {
  if (!item && !isLoading) return null;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const isWord = item && 'word' in item;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      ></div>
      
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-300 shadow-2xl rounded-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-[110] p-2 bg-gray-900/50 hover:bg-red-500 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
        >
          <X size={20} />
        </button>

        {isLoading && (
          <div className="absolute inset-0 z-[105] bg-gray-900/40 backdrop-blur-md flex flex-col items-center justify-center text-emerald-400 font-bold uppercase tracking-widest gap-3">
             <RefreshCw size={32} className="animate-spin" />
             Tra cứu nhanh...
          </div>
        )}

        {item && (
          isWord ? (
            <WordCard 
              data={item as WordData} 
              isSaved={isSaved} 
              onToggleSave={onToggleSave} 
              sheetsUrl={sheetsUrl}
              onLookup={onLookup}
            />
          ) : (
            <SentenceCard 
              data={item as SentenceData} 
              isSaved={isSaved} 
              onToggleSave={onToggleSave} 
              sheetsUrl={sheetsUrl}
              onLookup={onLookup}
            />
          )
        )}
      </div>
    </div>
  );
};
