
import { GoogleGenAI, Type } from "@google/genai";
// Fixed: Removed missing and unused export member 'ERAN_STRATEGY_PROMPT' from constants
import { RAZ_ZEHAVI_PROMPT } from "./constants";
import { Player, Team, HistoricalMatch } from "./types";

export const generateRazColumn = async () => {
  try {
    // Fixed: Create a new GoogleGenAI instance right before making an API call to ensure it always uses the most up-to-date API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "תכתוב טור סיכום קורע מצחוק על מחזור 21 בליגת פנטזי לוזון. תתמקד בניצחון של חמסילי על פיציצי ובקריסה של חולוניה.",
      config: {
        systemInstruction: RAZ_ZEHAVI_PROMPT,
        temperature: 0.9,
      },
    });
    return response.text || "ביזיון! הטור לא נטען!";
  } catch (error) {
    return "רז זהבי: שערורייה! אין לי אינטרנט! ציון 2 לביצועים של השרת!";
  }
};

export const chatWithCommish = async (query: string, leagueContext: any) => {
  try {
    // Fixed: Create a new GoogleGenAI instance right before making an API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `הקשר ליגה: ${JSON.stringify(leagueContext)}. שאלה מהמשתמש: ${query}`,
      config: {
        systemInstruction: "אתה הקוממישינר של פנטזי לוזון. ענה בשפה מקצועית, אנליטית ומעט צינית (כמו מנהל ליגה מנוסה). השתמש בנתונים מההקשר שסופק.",
      },
    });
    return response.text;
  } catch (error) {
    return "המנהל כרגע בישיבה במנהלת הליגה. נסה שוב מאוחר יותר.";
  }
};

export const getScoutingReport = async (playerName: string) => {
  try {
    // Fixed: Create a new GoogleGenAI instance right before making an API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `תן לי דו"ח סקאוטינג מעודכן על השחקן ${playerName} מליגת העל הישראלית לעונת 24/25. כולל סטטיסטיקות, כושר נוכחי וקישורים למקורות.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return {
      text: response.text,
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    return { text: "לא הצלחתי למצוא נתונים על השחקן כרגע.", sources: [] };
  }
};

export const generatePowerRankings = async (teams: Team[], history: HistoricalMatch[]) => {
  try {
    // Fixed: Create a new GoogleGenAI instance right before making an API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const data = JSON.stringify({ 
      // Fixed: Removed 'form: t.form' as the 'form' property does not exist on the 'Team' type
      teams: teams.map(t => ({ name: t.teamName, pts: t.points })), 
      history: history.slice(0, 5) 
    });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `נתח את יחסי הכוחות בליגה על בסיס התוצאות האחרונות והטבלה: ${data}. דרג את 3 הקבוצות החזקות והסבר למה בסגנון של אנליסט ערוץ הספורט.`,
    });
    return response.text;
  } catch (error) {
    return "האנליסט בחופשה, אבל חראלה נראית בלתי עצירה.";
  }
};
