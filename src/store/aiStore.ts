import { create } from "zustand";
import { persist } from "zustand/middleware";
import { chat, generateAutoDashboard, DashboardSuggestion, AIResponse } from "@/lib/ai/anthropic";
import { TableSchema } from "./dataStore";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface AIState {
  apiKey: string | null;
  isConfigured: boolean;
  
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  
  lastSuggestion: DashboardSuggestion | null;

  setApiKey: (key: string) => void;
  clearApiKey: () => void;
  
  // Simplified sendMessage that takes a context string
  sendMessage: (content: string, context?: string) => Promise<void>;
  
  // Schema-based sendMessage for structured queries
  sendMessageWithSchema: (
    content: string,
    schema: TableSchema[],
    tableName: string,
    sampleData?: any[]
  ) => Promise<AIResponse | null>;
  
  generateDashboard: (
    schema: TableSchema[],
    tableName: string,
    sampleData: any[]
  ) => Promise<DashboardSuggestion | null>;
  
  clearMessages: () => void;
  clearError: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      apiKey: null,
      isConfigured: false,
      messages: [],
      isLoading: false,
      error: null,
      lastSuggestion: null,

      setApiKey: (key: string) => {
        set({ apiKey: key, isConfigured: true });
      },

      clearApiKey: () => {
        set({ apiKey: null, isConfigured: false });
      },

      sendMessage: async (content: string, context?: string) => {
        const state = get();
        if (!state.apiKey) {
          set({ error: "API key not configured" });
          return;
        }

        const userMessage: Message = {
          id: generateId(),
          role: "user",
          content,
          timestamp: Date.now(),
        };
        
        const newMessages = [...state.messages, userMessage];
        set({ messages: newMessages, isLoading: true, error: null });

        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": state.apiKey,
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 2048,
              system: "You are an AI assistant for Board, a data dashboard application. Help users understand and visualize their data. Be concise and helpful. " + (context || ""),
              messages: newMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error("API error: " + errorText);
          }

          const data = await response.json();
          const assistantContent = data.content[0]?.text || "Sorry, I could not generate a response.";

          const assistantMessage: Message = {
            id: generateId(),
            role: "assistant",
            content: assistantContent,
            timestamp: Date.now(),
          };
          
          set({
            messages: [...newMessages, assistantMessage],
            isLoading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to send message",
            isLoading: false,
          });
        }
      },

      sendMessageWithSchema: async (content, schema, tableName, sampleData) => {
        const state = get();
        if (!state.apiKey) {
          set({ error: "API key not configured" });
          return null;
        }

        const userMessage: Message = {
          id: generateId(),
          role: "user",
          content,
          timestamp: Date.now(),
        };
        const newMessages = [...state.messages, userMessage];
        
        set({ messages: newMessages, isLoading: true, error: null });

        try {
          const response = await chat(
            state.apiKey,
            newMessages.map(m => ({ role: m.role, content: m.content })),
            schema,
            tableName,
            sampleData
          );

          const assistantMessage: Message = {
            id: generateId(),
            role: "assistant",
            content: response.text,
            timestamp: Date.now(),
          };
          
          set({
            messages: [...newMessages, assistantMessage],
            isLoading: false,
            lastSuggestion: response.dashboardSuggestion || null,
          });

          return response;
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to send message",
            isLoading: false,
          });
          return null;
        }
      },

      generateDashboard: async (schema, tableName, sampleData) => {
        const state = get();
        if (!state.apiKey) {
          set({ error: "API key not configured" });
          return null;
        }

        set({ isLoading: true, error: null });

        try {
          const suggestion = await generateAutoDashboard(
            state.apiKey,
            schema,
            tableName,
            sampleData
          );

          set({ isLoading: false, lastSuggestion: suggestion });
          return suggestion;
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to generate dashboard",
            isLoading: false,
          });
          return null;
        }
      },

      clearMessages: () => {
        set({ messages: [], lastSuggestion: null });
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "board-ai-storage",
      partialize: (state) => ({ apiKey: state.apiKey, isConfigured: state.isConfigured }),
    }
  )
);
