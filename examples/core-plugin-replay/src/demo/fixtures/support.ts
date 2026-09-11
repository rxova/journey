export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const createLogStore = <T>() => {
  let entries: T[] = [];
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => entries,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push: (entry: T) => {
      entries = [...entries.slice(-39), entry];
      listeners.forEach((listener) => listener());
    },
    reset: () => {
      entries = [];
      listeners.forEach((listener) => listener());
    }
  };
};

export const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

export const createStoragePreview = (key: string) => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) ?? "";
};
