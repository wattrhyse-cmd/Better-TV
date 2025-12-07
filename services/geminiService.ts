import { GoogleGenAI } from "@google/genai";
import { StreamItem } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

// Safely initialize client only when needed to avoid immediate errors if key is missing
const getClient = () => {
  if (!GEMINI_API_KEY) return null;
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
};

export const getAIRecommendations = async (
  query: string,
  availableStreams: StreamItem[]
): Promise<string> => {
  const ai = getClient();
  if (!ai) {
    return "Please configure your API Key to use the AI Assistant.";
  }

  // Optimize context size by only sending relevant fields
  const simplifiedStreams = availableStreams.map(s => ({
    id: s.stream_id,
    name: s.name,
    type: s.stream_type,
    catId: s.category_id
  }));

  const prompt = `
    You are an intelligent TV assistant for an IPTV app. 
    User Query: "${query}"
    
    Here is the list of available channels/movies in JSON format:
    ${JSON.stringify(simplifiedStreams).slice(0, 10000)} 
    
    Based on the user's query, recommend up to 5 items from the list.
    Return the response as a friendly chat message, bolding the channel names.
    If you can't find anything exact, suggest something similar.
    Keep it short and concise.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "I couldn't generate a recommendation at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Sorry, I encountered an error while processing your request.";
  }
};
