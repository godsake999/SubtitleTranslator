import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Log API Key presence (masked for safety)
console.log(`Gemini API Key loaded: ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 4) + "..." : "MISSING"}`);

export const translationModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
        temperature: 0,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 65536, // Burmese Unicode is very token-heavy, need large output
    },
});

export async function translateToBurmese(textList: string[]): Promise<string[]> {
    const prompt = `You are a professional movie subtitle translator.
Translate each English line below into natural, conversational Burmese.
Keep translations concise (subtitle-appropriate length).

CRITICAL: Return ONLY valid JSON. No markdown, no explanation.

Input: ${JSON.stringify(textList)}

Return exactly this format:
{"translations":["line1_in_burmese","line2_in_burmese"]}`;

    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Sending batch of ${textList.length} lines to Gemini (attempt ${attempt + 1})...`);
            const result = await translationModel.generateContent(prompt);
            const response = result.response;
            let text = response.text();

            // Remove markdown code fences if present
            text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

            // Try to fix truncated JSON by closing any open arrays/objects
            if (!text.endsWith("}")) {
                // Find the last complete string in the array
                const lastQuoteIdx = text.lastIndexOf('"');
                if (lastQuoteIdx > 0) {
                    text = text.substring(0, lastQuoteIdx + 1) + "]}";
                    console.log("Warning: Fixed truncated JSON response");
                }
            }

            const json = JSON.parse(text);
            if (!json.translations || !Array.isArray(json.translations)) {
                console.error("Invalid response format from Gemini:", text.substring(0, 200));
                throw new Error("Invalid response format from Gemini");
            }

            console.log(`Successfully translated ${json.translations.length}/${textList.length} lines.`);

            // If we got fewer translations than input, pad with empty strings
            while (json.translations.length < textList.length) {
                json.translations.push("");
            }

            return json.translations as string[];
        } catch (error) {
            console.error(`Gemini Translation Error (attempt ${attempt + 1}):`, error);
            if (attempt === MAX_RETRIES) {
                // Return empty strings instead of crashing
                console.log("All retries failed, returning empty translations for this batch");
                return textList.map(() => "");
            }
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return textList.map(() => "");
}
