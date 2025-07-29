const processedIds = new Set<string>();

export const wasAlreadyProcessed = (id: string): boolean => {
  return processedIds.has(id);
}

export const markAsProcessed = (id: string) => {
  processedIds.add(id);
}
