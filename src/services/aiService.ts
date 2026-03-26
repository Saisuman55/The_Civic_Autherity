import { toast } from "sonner";

function handleAIError(error: any, context: string) {
  console.error(`AI ${context} Error:`, error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes("429") || errorMessage.includes("rate") || errorMessage.includes("limit")) {
    toast.error("AI Intelligence core is busy. Please wait a moment before trying again (Rate limit exceeded).", {
      id: "ai-rate-limit",
      duration: 5000
    });
  }
}

export async function validateImage(imageBase64: string, category: string, description: string) {
  try {
    const response = await fetch("/api/ai/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageBase64, category, description }),
    });
    
    if (!response.ok) throw new Error("Validation request failed");
    return await response.json();
  } catch (error) {
    handleAIError(error, "Validation");
    return { isLikelyReal: false, confidence: 0, reasoning: "AI validation failed", detectedIssue: "Unknown" };
  }
}

export async function chatWithAI(message: string, history: any[] = [], location?: { latitude: number; longitude: number; address?: string }) {
  try {
    const locationContext = location 
      ? `\nUser Current Location: ${location.latitude}, ${location.longitude}${location.address ? ` (${location.address})` : ''}. Use this to provide context for nearby issues if asked.`
      : '';

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, locationContext }),
    });

    if (!response.ok) throw new Error("Chat request failed");
    const data = await response.json();
    return data.text;
  } catch (error) {
    handleAIError(error, "Chat");
    return "I'm sorry, I'm having trouble connecting to my intelligence core right now.";
  }
}

export async function transcribeAudio(audioBase64: string) {
  try {
    const response = await fetch("/api/ai/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: audioBase64 }),
    });

    if (!response.ok) throw new Error("Transcription request failed");
    const data = await response.json();
    return data.text || "";
  } catch (error) {
    handleAIError(error, "Transcription");
    return "";
  }
}
