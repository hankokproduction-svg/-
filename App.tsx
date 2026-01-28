import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  Utensils, 
  Clock, 
  List, 
  StickyNote, 
  ChevronLeft,
  Plus,
  Trash2,
  BrainCircuit,
  Bell,
  Terminal
} from 'lucide-react';
import { ViewState, AppData, Task, Meal, Note } from './types';
import { Card } from './components/Card';
import { Modal } from './components/Modal';
import { suggestSchedule, suggestMealPlan } from './services/geminiService';

// --- Helper Components for Views ---

const TaskItem: React.FC<{ task: Task, onToggle: (id: string) => void, onDelete: (id: string) => void }> = ({ task, onToggle, onDelete }) => (
  <div className={`flex items-center justify-between p-4 rounded-xl border mb-3 transition-all ${task.completed ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 shadow-sm hover:shadow-md'}`}>
    <div className="flex items-center gap-3 overflow-hidden">
      <button 
        onClick={() => onToggle(task.id)}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.completed ? 'bg-green-500 border-green-500' : 'border-slate-300 hover:border-blue-500'}`}
      >
        {task.completed && <CheckCircle2 size={14} className="text-white" />}
      </button>
      <div className="flex flex-col min-w-0">
        <span className={`text-base font-medium truncate ${task.completed ? 'text-slate-400 line-through' : 'text-black'}`}>
          {task.title}
        </span>
        {task.time && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
            <Clock size={12} />
            <span>{task.time}</span>
          </div>
        )}
      </div>
    </div>
    <button onClick={() => onDelete(task.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors">
      <Trash2 size={18} />
    </button>
  </div>
);

const MealItem: React.FC<{ meal: Meal, onDelete: (id: string) => void }> = ({ meal, onDelete }) => {
  const typeLabels: Record<string, { label: string, color: string }> = {
    breakfast: { label: 'Завтрак', color: 'bg-orange-100 text-orange-700' },
    lunch: { label: 'Обед', color: 'bg-green-100 text-green-700' },
    dinner: { label: 'Ужин', color: 'bg-indigo-100 text-indigo-700' },
    snack: { label: 'Перекус', color: 'bg-yellow-100 text-yellow-700' },
  };

  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm mb-3 flex justify-between items-start">
      <div>
        <span className={`text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block ${typeLabels[meal.type].color}`}>
          {typeLabels[meal.type].label}
        </span>
        <p className="text-black font-medium">{meal.description}</p>
        {meal.calories && <p className="text-xs text-slate-400 mt-1">{meal.calories} ккал</p>}
      </div>
      <button onClick={() => onDelete(meal.id)} className="text-slate-300 hover:text-red-500 p-1">
        <Trash2 size={16} />
      </button>
    </div>
  );
};

const NoteItem: React.FC<{ note: Note, onDelete: (id: string) => void }> = ({ note, onDelete }) => (
  <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-100 shadow-sm relative group hover:-translate-y-1 transition-transform duration-200">
    <button onClick={() => onDelete(note.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-yellow-700/50 hover:text-yellow-800 transition-opacity">
      <Trash2 size={16} />
    </button>
    <h3 className="font-bold text-black mb-2">{note.title}</h3>
    <p className="text-black text-sm whitespace-pre-wrap">{note.content}</p>
    <div className="mt-4 text-[10px] text-yellow-700/40 font-medium">
      {new Date(note.createdAt).toLocaleDateString()}
    </div>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  // Initial State
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem('lifeplanner-data');
    const parsed = saved ? JSON.parse(saved) : {};
    
    // Ensure default values exist even if loading from older local storage
    return {
      softwareNotes: '',
      schedule: [],
      nutrition: [],
      importantTasks: [],
      secondaryTasks: [],
      notes: [],
      ...parsed
    };
  });

  // Persist Data
  useEffect(() => {
    localStorage.setItem('lifeplanner-data', JSON.stringify(data));
  }, [data]);

  // Notifications Check
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkReminders = () => {
      const now = new Date();
      const currentParams = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const allTasks = [...data.schedule, ...data.importantTasks, ...data.secondaryTasks];
      const taskDue = allTasks.find(t => t.time === currentParams && !t.completed);

      if (taskDue) {
        new Notification("Напоминание", {
          body: taskDue.title,
          icon: "https://cdn-icons-png.flaticon.com/512/3239/3239952.png" // generic icon
        });
      }
    };

    const interval = setInterval(checkReminders, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [data]);


  // --- Input State for Forms ---
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemTime, setNewItemTime] = useState('');
  const [newItemContent, setNewItemContent] = useState('');
  const [newMealType, setNewMealType] = useState<Meal['type']>('breakfast');

  // --- Handlers ---

  const handleAddTask = (target: 'schedule' | 'importantTasks' | 'secondaryTasks') => {
    if (!newItemTitle.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      title: newItemTitle,
      completed: false,
      time: newItemTime || undefined,
      isImportant: target === 'importantTasks'
    };
    setData(prev => ({
      ...prev,
      [target]: [...prev[target], newTask].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    }));
    setNewItemTitle('');
    setNewItemTime('');
  };

  const handleDeleteTask = (target: 'schedule' | 'importantTasks' | 'secondaryTasks', id: string) => {
    setData(prev => ({ ...prev, [target]: prev[target].filter(t => t.id !== id) }));
  };

  const handleToggleTask = (target: 'schedule' | 'importantTasks' | 'secondaryTasks', id: string) => {
    setData(prev => ({
      ...prev,
      [target]: prev[target].map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    }));
  };

  const handleAddMeal = () => {
    if (!newItemTitle.trim()) return;
    const newMeal: Meal = {
      id: Date.now().toString(),
      type: newMealType,
      description: newItemTitle
    };
    setData(prev => ({ ...prev, nutrition: [...prev.nutrition, newMeal] }));
    setNewItemTitle('');
  };

  const handleDeleteMeal = (id: string) => {
    setData(prev => ({ ...prev, nutrition: prev.nutrition.filter(m => m.id !== id) }));
  };

  const handleAddNote = () => {
    if (!newItemTitle.trim() || !newItemContent.trim()) return;
    const newNote: Note = {
      id: Date.now().toString(),
      title: newItemTitle,
      content: newItemContent,
      createdAt: Date.now()
    };
    setData(prev => ({ ...prev, notes: [newNote, ...prev.notes] }));
    setNewItemTitle('');
    setNewItemContent('');
  };

  const handleDeleteNote = (id: string) => {
    setData(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== id) }));
  };

  const handleAIAction = async () => {
    setAiLoading(true);
    setAiResponse('');
    
    let result = '';
    if (view === ViewState.SCHEDULE) {
      result = await suggestSchedule([aiPrompt]);
    } else if (view === ViewState.NUTRITION) {
      result = await suggestMealPlan(aiPrompt);
    }
    
    setAiResponse(result);
    setAiLoading(false);
  };

  // --- Render Views ---

  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <Card 
        title="ПО" 
        icon={Terminal} 
        color="bg-slate-700" 
        description="Простое текстовое пространство для записей."
        onClick={() => setView(ViewState.SOFTWARE)}
      />
      <Card 
        title="Распорядок дня" 
        icon={Clock} 
        color="bg-blue-500" 
        description="Таймлайн ваших активностей и встреч."
        count={data.schedule.length}
        onClick={() => setView(ViewState.SCHEDULE)}
      />
      <Card 
        title="Питание" 
        icon={Utensils} 
        color="bg-green-500" 
        description="Завтраки, обеды и ужины."
        count={data.nutrition.length}
        onClick={() => setView(ViewState.NUTRITION)}
      />
      <Card 
        title="Важные задачи" 
        icon={CheckCircle2} 
        color="bg-red-500" 
        description="Приоритетные дела, которые нельзя отложить."
        count={data.importantTasks.filter(t => !t.completed).length}
        onClick={() => setView(ViewState.IMPORTANT_TASKS)}
      />
      <Card 
        title="Второстепенные" 
        icon={List} 
        color="bg-orange-400" 
        description="Дела, которые можно выполнить позже."
        count={data.secondaryTasks.filter(t => !t.completed).length}
        onClick={() => setView(ViewState.SECONDARY_TASKS)}
      />
      <Card 
        title="Месяц" 
        icon={Calendar} 
        color="bg-purple-500" 
        description="Обзорный календарь и долгосрочные цели."
        onClick={() => setView(ViewState.MONTH)}
      />
      <Card 
        title="Мысли и Заметки" 
        icon={StickyNote} 
        color="bg-yellow-400" 
        description="Записывайте идеи, инсайты и свободные мысли."
        count={data.notes.length}
        onClick={() => setView(ViewState.NOTES)}
      />
    </div>
  );

  const renderHeader = (title: string, colorClass: string, icon: React.ReactNode) => (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setView(ViewState.DASHBOARD)}
          className="p-2 rounded-full bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all shadow-sm border border-slate-200"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <span className={`p-2 rounded-lg ${colorClass} text-white`}>{icon}</span>
          {title}
        </h1>
      </div>
      {(view === ViewState.SCHEDULE || view === ViewState.NUTRITION) && (
        <button 
          onClick={() => { setIsAIModalOpen(true); setAiResponse(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity shadow-md"
        >
          <BrainCircuit size={18} />
          <span className="hidden sm:inline">AI Помощник</span>
        </button>
      )}
    </div>
  );

  const renderSoftwareView = () => (
    <div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
       {renderHeader("Программное Обеспечение", "bg-slate-700", <Terminal size={24}/>)}
       <div className="flex-1 bg-white relative p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          {/* Subtle Google-style gradients in corners */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent rounded-full blur-3xl -mr-32 -mt-64 pointer-events-none opacity-60"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-t from-red-50/30 to-transparent rounded-full blur-3xl -ml-32 -mb-64 pointer-events-none opacity-60"></div>
          
          <textarea
            className="w-full h-full resize-none focus:outline-none bg-transparent text-black text-lg leading-relaxed placeholder:text-slate-300 font-mono relative z-10"
            placeholder="Пространство для свободного текста..."
            value={data.softwareNotes}
            onChange={(e) => setData(prev => ({ ...prev, softwareNotes: e.target.value }))}
          />
       </div>
    </div>
  );

  const renderScheduleView = () => (
    <div className="max-w-4xl mx-auto">
      {renderHeader("Распорядок дня", "bg-blue-500", <Clock size={24}/>)}
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="flex gap-4 mb-4">
          <input 
            type="time" 
            value={newItemTime} 
            onChange={(e) => setNewItemTime(e.target.value)}
            className="p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
          />
          <input 
            type="text" 
            placeholder="Что нужно сделать?" 
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask('schedule')}
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-slate-400"
          />
          <button 
            onClick={() => handleAddTask('schedule')}
            className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {data.schedule.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            Расписание пока пусто. Добавьте задачу или используйте AI.
          </div>
        ) : (
          data.schedule.map(task => (
            <TaskItem 
              key={task.id} 
              task={task} 
              onToggle={(id) => handleToggleTask('schedule', id)}
              onDelete={(id) => handleDeleteTask('schedule', id)}
            />
          ))
        )}
      </div>
    </div>
  );

  const renderNutritionView = () => (
    <div className="max-w-4xl mx-auto">
      {renderHeader("Питание", "bg-green-500", <Utensils size={24}/>)}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select 
            value={newMealType} 
            onChange={(e) => setNewMealType(e.target.value as any)}
            className="p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black"
          >
            <option value="breakfast">Завтрак</option>
            <option value="lunch">Обед</option>
            <option value="dinner">Ужин</option>
            <option value="snack">Перекус</option>
          </select>
          <input 
            type="text" 
            placeholder="Что будете есть?" 
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMeal()}
            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black placeholder:text-slate-400"
          />
          <button 
            onClick={handleAddMeal}
            className="bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(type => {
          const meals = data.nutrition.filter(m => m.type === type);
          return (
            <div key={type} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="font-bold text-slate-700 capitalize mb-3 flex items-center gap-2">
                {type === 'breakfast' && '☕'}
                {type === 'lunch' && '🍲'}
                {type === 'dinner' && '🍽️'}
                {type === 'snack' && '🍎'}
                {type === 'breakfast' ? 'Завтрак' : type === 'lunch' ? 'Обед' : type === 'dinner' ? 'Ужин' : 'Перекус'}
              </h3>
              {meals.length === 0 && <p className="text-sm text-slate-400">Пусто</p>}
              {meals.map(meal => <MealItem key={meal.id} meal={meal} onDelete={handleDeleteMeal} />)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderGenericTaskView = (title: string, type: 'importantTasks' | 'secondaryTasks', color: string, ringColor: string) => (
    <div className="max-w-4xl mx-auto">
      {renderHeader(title, color, type === 'importantTasks' ? <CheckCircle2 size={24}/> : <List size={24}/>)}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="flex gap-4">
          <input 
            type="text" 
            placeholder="Добавить новую задачу..." 
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(type)}
            className={`flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 ${ringColor} text-black placeholder:text-slate-400`}
          />
          <button 
            onClick={() => handleAddTask(type)}
            className={`${color} text-white p-3 rounded-lg hover:opacity-90 transition-opacity`}
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {data[type].map(task => (
          <TaskItem 
            key={task.id} 
            task={task} 
            onToggle={(id) => handleToggleTask(type, id)}
            onDelete={(id) => handleDeleteTask(type, id)}
          />
        ))}
        {data[type].length === 0 && (
          <div className="text-center py-10 text-slate-400 flex flex-col items-center">
            <CheckCircle2 size={48} className="mb-4 opacity-20" />
            <p>Задач нет. Отличная работа!</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderNotesView = () => (
    <div className="max-w-6xl mx-auto">
      {renderHeader("Мысли и Заметки", "bg-yellow-400", <StickyNote size={24}/>)}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <input 
          type="text" 
          placeholder="Заголовок..." 
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 font-bold text-black placeholder:text-slate-400"
        />
        <textarea 
          placeholder="О чем вы думаете?" 
          value={newItemContent}
          onChange={(e) => setNewItemContent(e.target.value)}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg h-32 mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 text-black placeholder:text-slate-400"
        />
        <div className="flex justify-end">
          <button 
            onClick={handleAddNote}
            className="bg-yellow-400 text-yellow-900 font-medium px-6 py-2 rounded-lg hover:bg-yellow-500 transition-colors"
          >
            Сохранить заметку
          </button>
        </div>
      </div>

      <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
        {data.notes.map(note => (
          <div key={note.id} className="break-inside-avoid">
             <NoteItem note={note} onDelete={handleDeleteNote} />
          </div>
        ))}
      </div>
    </div>
  );

  const renderMonthView = () => (
    <div className="max-w-4xl mx-auto h-[80vh] flex flex-col">
       {renderHeader("Календарь", "bg-purple-500", <Calendar size={24}/>)}
       <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex items-center justify-center flex-col text-slate-400">
          <Calendar size={64} className="mb-4 opacity-20" />
          <p className="text-lg">Обзор месяца</p>
          <p className="text-sm mt-2">Здесь будет календарная сетка в следующем обновлении.</p>
          {/* Placeholder for complex calendar logic */}
          <div className="grid grid-cols-7 gap-4 mt-8 w-full max-w-lg opacity-30">
             {Array.from({length: 31}).map((_, i) => (
               <div key={i} className="aspect-square bg-slate-100 rounded-md flex items-center justify-center text-xs">
                 {i + 1}
               </div>
             ))}
          </div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      {view === ViewState.DASHBOARD && (
        <div className="mb-8 max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Мой День</h1>
          <p className="text-slate-500">Планируйте, достигайте и запоминайте.</p>
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        {view === ViewState.DASHBOARD && renderDashboard()}
        {view === ViewState.SOFTWARE && renderSoftwareView()}
        {view === ViewState.SCHEDULE && renderScheduleView()}
        {view === ViewState.NUTRITION && renderNutritionView()}
        {view === ViewState.IMPORTANT_TASKS && renderGenericTaskView("Важные задачи", "importantTasks", "bg-red-500", "focus:ring-red-500")}
        {view === ViewState.SECONDARY_TASKS && renderGenericTaskView("Второстепенные задачи", "secondaryTasks", "bg-orange-400", "focus:ring-orange-400")}
        {view === ViewState.MONTH && renderMonthView()}
        {view === ViewState.NOTES && renderNotesView()}
      </div>

      <Modal 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
        title={view === ViewState.SCHEDULE ? "AI Планировщик Расписания" : "AI Диетолог"}
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            {view === ViewState.SCHEDULE 
              ? "Опишите ваши задачи, и я составлю для вас расписание." 
              : "Напишите, какие продукты у вас есть, и я предложу меню."}
          </p>
          <textarea
            className="w-full p-3 border border-slate-300 rounded-lg h-32 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-black placeholder:text-slate-400"
            placeholder={view === ViewState.SCHEDULE ? "Например: Сходить в зал, написать отчет, встреча с Анной..." : "Например: Есть курица, рис, яйца..."}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          
          {aiResponse && (
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-slate-800 text-sm whitespace-pre-wrap">
              {aiResponse}
            </div>
          )}

          <div className="flex justify-end pt-2">
             <button
              onClick={handleAIAction}
              disabled={aiLoading || !aiPrompt.trim()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
             >
               {aiLoading ? (
                 <>
                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   Думаю...
                 </>
               ) : (
                 <>
                   <BrainCircuit size={18} />
                   Сгенерировать
                 </>
               )}
             </button>
          </div>
        </div>
      </Modal>

      {/* Floating Action Button for returning home on mobile if deep in navigation, though top header handles it mostly */}
      {view !== ViewState.DASHBOARD && (
        <div className="fixed bottom-6 right-6 md:hidden">
          <button 
            onClick={() => setView(ViewState.DASHBOARD)}
            className="p-4 bg-slate-800 text-white rounded-full shadow-lg hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        </div>
      )}
    </div>
  );
}