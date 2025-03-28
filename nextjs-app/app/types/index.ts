export type ActionState<TData = undefined> = {
  isSuccess: boolean;
  message?: string;
  data?: TData;
  error?: Record<string, string[]>;
}; 