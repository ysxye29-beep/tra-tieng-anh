
import React from 'react';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 w-full max-w-2xl mx-auto p-4 sm:p-6 animate-pulse">
      <div className="flex justify-between items-start border-b border-gray-700 pb-4 mb-4">
        <div className="space-y-2">
          <div className="h-8 bg-gray-700 rounded w-40"></div>
          <div className="h-4 bg-gray-700 rounded w-24"></div>
        </div>
        <div className="h-10 w-10 bg-gray-700 rounded-xl"></div>
      </div>
      <div className="space-y-4">
        <div className="h-12 bg-gray-700 rounded-xl w-full"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-16 bg-gray-700 rounded-xl"></div>
          <div className="h-16 bg-gray-700 rounded-xl"></div>
        </div>
        <div className="h-20 bg-gray-700 rounded-xl w-full"></div>
      </div>
    </div>
  );
};
