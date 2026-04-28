import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export { AppError };

export const errorHandler = (
  error: Error | AppError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  console.error('Error:', error);

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    });
    return;
  }

  if (error instanceof ZodError) {
    const hasBarcodeError = error.errors.some((e) =>
      Array.isArray(e.path) ? e.path.some((segment) => String(segment) === 'barcode') : false
    );

    res.status(400).json({
      success: false,
      message: 'Validation error',
      ...(hasBarcodeError ? { code: 'invalid_barcode' } : {}),
      errors: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(isProd
      ? {}
      : {
          error: {
            name: error?.name,
            message: (error as any)?.message,
          },
        }),
  });
};
