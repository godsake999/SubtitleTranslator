import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const translationModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest", // Using latest tracking version
    generationConfig: {
        temperature: 0,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
    },
});

export async function translateToBurmese(textList: string[]) {
    const prompt = `
    You are a professional translator specializing in movie subtitles. 
    Translate the following list of English subtitle lines into natural, conversational Burmese.
    Ensure the translation fits the context of a movie.
    Keep the meaning accurate and culturally relevant for Burmese audiences.
    
    Return the result as a JSON array of strings, in the same order as the input.
    Input strings: ${JSON.stringify(textList)}
    
    Response format:
    {
      "translations": ["translated_line_1", "translated_line_2", ...]
    }
  `;

    try {
        console.log(`Sending batch of ${textList.length} lines to Gemini...`);
        const result = await translationModel.generateContent(prompt);
        const response = result.response;
        let text = response.text();

        // Remove markdown formatting if present
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();

        const json = JSON.parse(text);
        if (!json.translations || !Array.isArray(json.translations)) {
            console.error("Invalid response format from Gemini:", text);
            throw new Error("Invalid response format from Gemini");
        }

        console.log(`Successfully translated ${json.translations.length} lines.`);
        return json.translations as string[];
    } catch (error) {
        console.error("Gemini Translation Error Details:", error);
        throw error;
    }
}
