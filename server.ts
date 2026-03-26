import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config({ override: true });

console.log("Environment Variables Check:");
console.log("- GEMINI_API_KEY exists:", !!process.env.GEMINI_API_KEY);
console.log("- API_KEY exists:", !!process.env.API_KEY);

const modelName = "gemini-3-flash-preview";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // AI Routes
  app.post("/api/ai/validate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.json({
          isLikelyReal: false,
          confidence: 0,
          reasoning: "AI features are disabled. Please configure your Gemini API key in the AI Studio Secrets panel.",
          detectedIssue: "Unknown"
        });
      }
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const { image, category, description } = req.body;
      
      // Handle data URL or raw base64
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      
      const prompt = `Analyze the image and determine if it depicts a real, genuine civic issue matching the stated category and description.
Category: ${category || "General Civic Issue"}
Description: ${description || "No description provided."}

Return ONLY a valid JSON object. No markdown, no explanation text, no code fences. Just the raw JSON:
{
  "isLikelyReal": boolean,
  "confidence": number (0.0-1.0),
  "reasoning": string (1-3 sentences),
  "detectedIssue": string
}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error("AI Validation Error:", error);
      res.status(500).json({ error: "Validation failed" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.json({ text: "Please configure your Gemini API key in the AI Studio Secrets panel to enable AI features." });
      }
      
      const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
      console.log(`Using API key: ${maskedKey} (length: ${apiKey.length})`);
      
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const { message, history, locationContext } = req.body;
      const chat = ai.chats.create({
        model: modelName,
        config: {
          systemInstruction: `You are "Authority AI" — the intelligent assistant for The Civic Authority.
Role: Efficient, direct, and highly technical civic assistant.
Objective: Provide pinpoint, concise answers. Zero fluff. No conversational filler.
Topics: Issue reporting, status tracking, trust scores, Indian civic rules, app navigation.
Constraint: Max 2-3 sentences per response unless complex instructions are required.
Tone: Professional, robotic efficiency, helpful but brief.
Language: Match user language (English, Hindi, Odia, etc.).${locationContext || ""}`,
        },
        history: (history || []).map((msg: any) => ({
          role: msg.role,
          parts: [{ text: msg.text }],
        })),
      });

      const response = await chat.sendMessage({ message });
      res.json({ text: response.text });
    } catch (error) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ 
        error: "Chat failed", 
        debug: {
          geminiKeyType: typeof process.env.GEMINI_API_KEY,
          geminiKeyLength: process.env.GEMINI_API_KEY?.length,
          apiKeyType: typeof process.env.API_KEY,
          apiKeyLength: process.env.API_KEY?.length
        }
      });
    }
  });

  app.post("/api/ai/transcribe", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.json({ text: "AI transcription is disabled. Please configure your Gemini API key in the AI Studio Secrets panel." });
      }
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const { audio } = req.body;
      const prompt = `Convert the spoken audio description into a clean, structured 1-2 sentence text suitable for the issue description field of a civic report.
Output in English regardless of input language. Do not include any prefix.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "audio/webm",
                  data: audio,
                },
              },
            ],
          },
        ],
      });

      res.json({ text: response.text?.trim() || "" });
    } catch (error) {
      console.error("AI Transcription Error:", error);
      res.status(500).json({ error: "Transcription failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

