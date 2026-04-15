import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";

export function useGenerateTitle() {
  return useMutation({
    mutationFn: async ({ content, type }: { content: string; type: string }) => {
      const response = await apiRequest("POST", "/api/ai/generate-title", { content, type });
      return response.json();
    },
  });
}

export function useGenerateSummary() {
  return useMutation({
    mutationFn: async ({ content, title }: { content: string; title?: string }) => {
      const response = await apiRequest("POST", "/api/ai/generate-summary", { content, title });
      return response.json();
    },
  });
}

export function useImproveContent() {
  return useMutation({
    mutationFn: async ({ content, sectionType }: { content: string; sectionType: string }) => {
      const response = await apiRequest("POST", "/api/ai/improve-content", { content, sectionType });
      return response.json();
    },
  });
}

export function useRefineContent() {
  return useMutation({
    mutationFn: async ({ content, feedback }: { content: string; feedback: string }) => {
      const response = await apiRequest("POST", "/api/ai/refine-content", { content, feedback });
      return response.json();
    },
  });
}

export function useGenerateSection() {
  return useMutation({
    mutationFn: async ({ topic, sectionType }: { topic: string; sectionType: string }) => {
      const response = await apiRequest("POST", "/api/ai/generate-section", { topic, sectionType });
      return response.json();
    },
  });
}
