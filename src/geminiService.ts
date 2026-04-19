import { GoogleGenAI } from "@google/genai";

// 🟢 המפתח שלך מוטמע כאן ישירות 🟢
const GEMINI_API_KEY = "AIzaSyDsXUeI2CUSm4bz5A2K32BFOOa5xkRPtvk";

const getApiKey = (providedKey?: string) => {
  return providedKey || 
         process.env.GEMINI_API_KEY || 
         localStorage.getItem('gemini_api_key') || 
         GEMINI_API_KEY;
};

// 🟢 פונקציית עזר למניעת תקיעות - מוקצב ל-45 שניות (זמן סביר לסריקת מסמכים) 🟢
const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number = 45000) => {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout: The request took longer than ${timeoutMs / 1000} seconds`)), timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timer!);
        return result;
    } catch (e) {
        clearTimeout(timer!);
        throw e;
    }
};

export const analyzeMatchImage = async (base64Data: string, mimeType: string, hint?: string, apiKey?: string) => {
  const activeKey = getApiKey(apiKey);
  
  // 🟢 שימוש ב-SDK המודרני 🟢
  const ai = new GoogleGenAI({ apiKey: activeKey }); 
  
  const prompt = `אתה סוכן AI מומחה ופדנט לחילוץ נתונים מטבלאות ספורט מורכבות ומסמכי PDF רשמיים.
אני מספק לך תמונה או קובץ PDF של משחקי ליגת העל בכדורגל (ישראל). 
רמז למחזור שצריך לחלץ: "${hint || 'לא ידוע'}".

המשימה שלך היא לחלץ את המשחקים ולהחזיר אותם אך ורק כמערך JSON חוקי.

🚨 חוקי ברזל לסריקה מושלמת (קריטי להצלחת המשימה!) 🚨:
1. **סרוק את כל המסמך ביסודיות, שורה אחר שורה, מההתחלה ועד הסוף!** אל תעצור עד שסיימת לקרוא הכל.
2. חפש את המספר שניתן לך ברמז (למשל מחזור 28, 30, 32 או 33).
3. **שים לב לפלייאוף!** המחזור יכול להיות מפוצל ל"פלייאוף עליון" ו"פלייאוף תחתון". אם ביקשתי מחזור מסוים, עליך למצוא ולחלץ את *כל* המשחקים של אותו מחזור משני הפלייאופים יחד!
4. אל תניח שיש מספר קבוע של משחקים. יכולים להיות 3, 4, 6 או 7 משחקים. חלץ את כולם.
5. קרא בעיון כל טבלה. לפעמים שמות הקבוצות או התאריכים נשברים לשורות נפרדות. חבר אותם למשחק אחד.
6. השעה של המשחק היא קריטית! חלץ אותה במדויק.

החזר אך ורק מערך JSON, ללא שום טקסט או הסבר נוסף (ללא פורמט Markdown כמו \`\`\`json).

כל אובייקט במערך חייב לכלול בדיוק את המפתחות הבאים:
- "round": (מספר שלם לפי הרמז שסיפקתי).
- "homeTeam": (מחרוזת) שם קבוצת הבית בעברית.
- "awayTeam": (מחרוזת) שם קבוצת החוץ בעברית.
- "date": (מחרוזת) תאריך המשחק (למשל 19.04 או 19/04). 
- "time": (מחרוזת) שעת המשחק המדויקת בפורמט HH:MM בלבד (למשל "20:00"). ללא מילים נוספות!
- "stadium": (מחרוזת) חלץ את שם המגרש/אצטדיון בעברית (למשל "סמי עופר", "בלומפילד", "דוחא", "טרנר", "שלמה ביטוח"). אם לא מופיע, החזר "".
- "tvChannel": (מחרוזת) ערוץ שידור אם יש, אחרת "".`;

  // 🟢 שימוש במודל החדיש והיציב ביותר 🟢
  const modelName = "gemini-3-flash-preview";

  try {
      console.log(`מפעיל חילוץ PDF/תמונה עם ${modelName}...`);
      const requestPromise = ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }] }]
      });

      const response = await fetchWithTimeout(requestPromise, 45000); 

      const text = response.text;
      if (!text) throw new Error("No response from Gemini AI");

      const cleanJsonText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJsonText);
  } catch (error: any) {
      console.error(`שגיאה בחילוץ נתונים (${modelName}):`, error);
      throw new Error(`שגיאת התחברות לשרת ה-AI: ${error.message}. נסה לרענן את העמוד או נסה שוב מאוחר יותר.`);
  }
};

export const generateAISummary = async (fixtures: any[], teams: any[], apiKey?: string) => {
    const activeKey = getApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: activeKey });

    const sortedTeams = [...teams].filter(t => t.id !== 'admin' && t.id !== 'system').sort((a, b) => {
        const aPts = a.points || 0; const bPts = b.points || 0;
        if (bPts !== aPts) return bPts - aPts;
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

    try {
        const requestPromise = ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
        const response = await fetchWithTimeout(requestPromise, 25000);
        return response.text || "";
    } catch (error: any) {
        console.error("Summary generation failed:", error);
        throw error;
    }
};

export const generateRumors = async (teams: any[], apiKey?: string) => {
    const activeKey = getApiKey(apiKey);
    const ai = new GoogleGenAI({ apiKey: activeKey });

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

    try {
        const requestPromise = ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt });
        const response = await fetchWithTimeout(requestPromise, 25000);
        return response.text || "";
    } catch (error: any) {
        console.error("Rumors generation failed:", error);
        throw error;
    }
};