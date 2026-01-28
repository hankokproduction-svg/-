import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  title: string;
  icon: LucideIcon;
  color: string;
  description: string;
  onClick: () => void;
  count?: number;
}

export const Card: React.FC<CardProps> = ({ title, icon: Icon, color, description, onClick, count }) => {
  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden p-6 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-slate-100 group hover:-translate-y-1`}
    >
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <Icon size={80} />
      </div>
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div>
          <div className={`p-3 rounded-xl w-fit mb-4 ${color} text-white shadow-lg shadow-${color}/30`}>
            <Icon size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-1">{title}</h3>
          <p className="text-slate-500 text-sm line-clamp-2">{description}</p>
        </div>
        
        {count !== undefined && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-700">{count}</span>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Записей</span>
          </div>
        )}
      </div>
    </div>
  );
};