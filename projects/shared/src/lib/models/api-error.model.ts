// projects/shared/src/lib/models/api-error.model.ts
export class ApiError extends Error {
  constructor(
    public readonly errorId: string,
    message: string,
    public readonly httpStatus: number
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
  }
}
