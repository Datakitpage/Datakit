import { create } from "zustand";
import { persist } from "zustand/middleware";
import { chat, generateAutoDashboard, DashboardSuggestion, AIResponse } from "@/lib/ai/anthropic";
import { TableSchema } from "./dataStore";
import { useSettingsStore } from "./settingsStore";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface AIState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;

  lastSuggestion: DashboardSuggestion | null;

  // Simplified sendMessage that takes a context string
  sendMessage: (content: string, context?: string) => Promise<void>;

  // Schema-based sendMessage for structured queries
  sendMessageWithSchema: (
    content: string,
    schema: TableSchema[],
    tableName: string,
    sampleData?: Record<string, unknown>[]
  ) => Promise<AIResponse | null>;

  generateDashboard: (
    schema: TableSchema[],
    tableName: string,
    sampleData: Record<string, unknown>[]
  ) => Promise<DashboardSuggestion | null>;

  clearMessages: () => void;
  clearError: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to get API key from settings store
const getApiKey = () => useSettingsStore.getState().anthropicApiKey;

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      error: null,
      lastSuggestion: null,

      sendMessage: async (content: string, context?: string) => {
        const apiKey = getApiKey();
        if (!apiKey) {
          set({ error: "API key not configured" });
          return;
        }

        const userMessage: Message = {
          id: generateId(),
          role: "user",
          content,
          timestamp: Date.now(),
        };

        const newMessages = [...get().messages, userMessage];
        set({ messages: newMessages, isLoading: true, error: null });

        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "anthropic-dangerous-direct-browser-access": "true",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 2048,
              system: "You are an AI assistant for OpenSheet, a data exploration application. Help users understand and visualize their data. Be concise and helpful. " + (context || ""),
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
        const apiKey = getApiKey();
        if (!apiKey) {
          set({ error: "API key not configured" });
          return null;
        }

        const userMessage: Message = {
          id: generateId(),
          role: "user",
          content,
          timestamp: Date.now(),
        };
        const newMessages = [...get().messages, userMessage];

        set({ messages: newMessages, isLoading: true, error: null });

        try {
          const response = await chat(
            apiKey,
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
        const apiKey = getApiKey();
        if (!apiKey) {
          set({ error: "API key not configured" });
          return null;
        }

        set({ isLoading: true, error: null });

        try {
          const suggestion = await generateAutoDashboard(
            apiKey,
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
      partialize: (state) => ({ messages: state.messages }),
    }
  )
);
