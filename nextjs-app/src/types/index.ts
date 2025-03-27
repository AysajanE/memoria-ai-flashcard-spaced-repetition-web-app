export type ActionState<TData = undefined> = {
  isSuccess: boolean;
  message?: string | null;
  error?: Record<string, string[]> | null; // For form field errors
  data?: TData;
}; 