import { GoogleGenAI } from "@google/genai";
import { GenerationConfig } from "../types";

export const generateVideo = async (
  config: GenerationConfig,
  onProgress: (status: string) => void
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  onProgress("Initializing session...");
  
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: config.prompt,
      config: {
        numberOfVideos: 1,
        resolution: config.resolution,
        aspectRatio: config.aspectRatio
      }
    });

    const messages = [
      "Crafting pixels...",
      "Synthesizing motion...",
      "Applying cinematic lighting...",
      "Refining details...",
      "Finalizing export..."
    ];
    let msgIndex = 0;

    while (!operation.done) {
      onProgress(messages[msgIndex % messages.length]);
      msgIndex++;
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      throw new Error("Failed to get video download link");
    }

    return `${downloadLink}&key=${process.env.API_KEY}`;
  } catch (error) {
    console.error("Veo Generation Error:", error);
    throw error;
  }
};

export const checkApiKey = async (): Promise<boolean> => {
  if (typeof window.aistudio?.hasSelectedApiKey === 'function') {
    return await window.aistudio.hasSelectedApiKey();
  }
  return false;
};

export const openApiKeyDialog = async () => {
  if (typeof window.aistudio?.openSelectKey === 'function') {
    await window.aistudio.openSelectKey();
  }
};