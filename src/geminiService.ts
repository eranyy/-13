import { GoogleGenAI } from "@google/genai";

// 🟢 המפתח שלך מוטמע כאן ישירות 🟢
const GEMINI_API_KEY = "AIzaSyDsXUeI2CUSm4bz5A2K32BFOOa5xkRPtvk";

const getApiKey = (providedKey?: string) => {
  return providedKey || 
         process.env.GEMINI_API_KEY || 
         localStorage.getItem('gemini_api_key') || 
         GEMINI_API_KEY;
};

export const analyzeMatchImage = async (base64Data: string, mimeType: string, hint?: string, apiKey?: string) => {
  const activeKey = getApiKey(apiKey);
  const ai = new GoogleGenAI({ apiKey: activeKey });
  
  const prompt = `אתה מומחה לחילוץ נתונים מלוחות משחקי כדורגל.
אני מספק לך תמונה או קובץ PDF של משחקי ליגת העל בכדורגל (ישראל). 
רמז למחזור: "${hint || 'לא ידוע'}".

המשימה שלך היא לחלץ את המשחקים ולהחזיר אותם אך ורק כמערך JSON.
אל תחזיר שום טקסט אחר (בלי הערות, בלי פתיח).

כל אובייקט במערך חייב לכלול בדיוק את המפתחות הבאים:
- "round": (מספר שלם לפי הרמז שסיפקתי. נחש אם חסר).
- "homeTeam": (מחרוזת) שם קבוצת הבית בעברית.
- "awayTeam": (מחרוזת) שם קבוצת החוץ בעברית.
- "date": (מחרוזת) תאריך המשחק.
- "time": (מחרוזת) שעת המשחק המדויקת בפורמט HH:MM בלבד (למשל "20:00" או "19:30"). אל תוסיף מילים כמו "שעה" או "PM". זה קריטי!
- "stadium": (מחרוזת) חלץ את שם המגרש/אצטדיון בעברית אם הוא מופיע ליד המשחק (למשל "בלומפילד", "סמי עופר", "הי״א", "טדי", "טרנר"). אם לא מופיע מגרש, החזר מחרוזת ריקה "".
- "tvChannel": (מחרוזת) ערוץ שידור אם יש, אחרת מחרוזת ריקה.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }]
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini AI");

    const cleanJsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJsonText);
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    throw new Error(error.message || "Failed to analyze image with Gemini AI");
  }
};

export const generateAISummary = async (fixtures: any[], teams: any[], apiKey?: string) => {
    const activeKey = getApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: activeKey });

    // 🟢 מכינים ל-AI את הטבלה בצורה של טקסט ממוספר ופשוט כדי שלא ימציא 🟢
    const sortedTeams = [...teams].filter(t => t.id !== 'admin' && t.id !== 'system').sort((a, b) => {
        const aPts = a.points || 0; const bPts = b.points || 0;
        if (bPts !== aPts) return bPts - aPts; // מיון יורד
        return ((b.gf || 0) - (b.ga || 0)) - ((a.gf || 0) - (a.ga || 0));
    });

    const leagueStandingsText = sortedTeams.map((t, index) => 
        `מקום ${index + 1}: ${t.teamName} (מנג'ר: ${t.name || t.manager}) | נקודות בטבלה: ${t.points || 0}`
    ).join('\n');

    const fixturesText = fixtures.map((m, index) => 
        `משחק ${index + 1}: ${m.homeTeam || m.h} נגד ${m.awayTeam || m.a}`
    ).join('\n');

    const prompt = `אתה פרשן כדורגל ישראלי בכיר (בסגנון רז זהבי או אבי מלר). 
כתוב סיכום מחזור מרגש, מקצועי ומשעשע עבור ליגת הפנטזי "לוזון 13".

🚨 חוקי ברזל חובה (קריטי!) 🚨
1. התבסס אך ורק על העובדות הבאות. אסור לך בשום אופן להמציא נתונים!
2. מיקומי הקבוצות בטבלה קבועים מראש - אל תשנה אותם או תגיד שקבוצה במקום ראשון אם היא לא!

--- טבלת הליגה המדויקת (נכון לעכשיו) ---
${leagueStandingsText}

--- משחקי המחזור שהיו ---
${fixturesText}

הסיכום צריך לכלול כותרת מפוצצת, התייחסות למובילת הטבלה, וסלנג כדורגל ישראלי. החזר בפורמט Markdown.`;

    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    return response.text || "";
};

export const generateRumors = async (teams: any[], apiKey?: string) => {
    const activeKey = getApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: activeKey });

    // 🟢 מכינים ל-AI רשימת שחקנים מסודרת לכל קבוצה, כדי שלא יעביר שחקנים מקבוצה לקבוצה בטעות 🟢
    const teamsWithPlayersText = teams.filter(t => t.id !== 'admin' && t.id !== 'system').map(t => {
        const playersList = (t.squad || []).map((p: any) => p.name).filter(Boolean).join(', ');
        return `* קבוצת ${t.teamName} (מנג'ר: ${t.name}):\n  שחקנים בסגל: ${playersList || 'אין שחקנים כרגע'}`;
    }).join('\n\n');

    const prompt = `אתה כתב רכילות ספורט בסגנון "צהוב" ומשעשע.
כתוב 3-4 שמועות חמות מחדרי ההלבשה של ליגת הפנטזי "לוזון 13".

🚨 חוקי ברזל חובה (קריטי!) 🚨
1. אתה יכול להמציא סיפורים מאחורי הקלעים (למשל: שחקן רב עם המאמן, איחר לאימון, אכל שווארמה בלילה).
2. **אסור** לך בשום פנים ואופן לשייך שחקן לקבוצה הלא נכונה! 
3. אל תמציא שמות של שחקנים או קבוצות שלא מופיעים ברשימה הבאה.

--- רשימת הקבוצות והשחקנים השייכים להן בוודאות ---
${teamsWithPlayersText}

החזר את השמועות בפורמט Markdown בצורה של מבזקי חדשות.`;

    const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
    return response.text || "";
};