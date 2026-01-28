export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SOFTWARE = 'SOFTWARE',
  SCHEDULE = 'SCHEDULE',
  NUTRITION = 'NUTRITION',
  IMPORTANT_TASKS = 'IMPORTANT_TASKS',
  SECONDARY_TASKS = 'SECONDARY_TASKS',
  MONTH = 'MONTH',
  NOTES = 'NOTES',
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  time?: string; // HH:MM
  date?: string; // YYYY-MM-DD
  isImportant: boolean;
}

export interface Meal {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  calories?: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface AppData {
  softwareNotes: string;
  schedule: Task[];
  nutrition: Meal[];
  importantTasks: Task[];
  secondaryTasks: Task[];
  notes: Note[];
}