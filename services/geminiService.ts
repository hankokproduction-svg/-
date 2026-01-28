import { GoogleGenAI } from "@google/genai";
import { AppData, Task, Meal } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-3-flash-preview';

export const suggestSchedule = async (tasks: string[]): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `У меня есть следующие задачи: ${tasks.join(', ')}. Составь оптимальное расписание на день с временными слотами. Ответь только списком в формате: "Время - Задача".`,
    });
    return response.text || "Не удалось создать расписание.";
  } catch (error) {
    console.error("Gemini schedule error:", error);
    return "Ошибка при генерации расписания.";
  }
};

export const suggestMealPlan = async (preferences: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Предложи план питания на день (завтрак, обед, ужин, перекус). Предпочтения/продукты: ${preferences}. Ответь кратко и структурированно.`,
    });
    return response.text || "Не удалось создать план питания.";
  } catch (error) {
    console.error("Gemini meal error:", error);
    return "Ошибка при генерации плана питания.";
  }
};

export const prioritizeTasks = async (taskList: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `У меня есть список дел: ${taskList}. Раздели их на "Важные" и "Второстепенные". Верни JSON список.`,
       config: {
        responseMimeType: "application/json",
      },
    });
    return response.text || "{}";
  } catch (error) {
    console.error("Gemini priority error:", error);
    return "{}";
  }
};