// projects/shared/src/lib/models/api-response.model.ts
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
  timestamp: number;
}
