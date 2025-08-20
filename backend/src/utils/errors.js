// src/utils/errors.js

/** Lỗi HTTP chuẩn hoá */
export class HttpError extends Error {
  constructor(status = 500, message = "Internal Server Error", { code, details } = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Gói route async để tự catch lỗi và next(err) */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Helper tạo lỗi nhanh */
export const badRequest   = (msg = "Bad Request", opts)    => new HttpError(400, msg, opts);
export const unauthorized = (msg = "Unauthorized", opts)   => new HttpError(401, msg, opts);
export const forbidden    = (msg = "Forbidden", opts)      => new HttpError(403, msg, opts);
export const notFound     = (msg = "Not Found", opts)      => new HttpError(404, msg, opts);
export const conflict     = (msg = "Conflict", opts)       => new HttpError(409, msg, opts);
export const serverError  = (msg = "Internal Server Error", opts) => new HttpError(500, msg, opts);

/** Chuẩn hoá lỗi từ Supabase (tuỳ chọn) */
export function fromSupabase(error, fallbackStatus = 400) {
  if (!error) return null;
  // Supabase thường có { message, code, details, hint? }
  return new HttpError(fallbackStatus, error.message || "Supabase error", {
    code: error.code,
    details: error.details ?? error.hint,
  });
}

/** Middleware cuối chuỗi để trả JSON lỗi đồng nhất */
export function sendError(err, req, res, next) {
  // Nếu đã là HttpError thì dùng luôn; nếu không, chuyển đổi (thử map từ supabase trước)
  const isHttp = err instanceof HttpError;

  let normalized = null;
  if (!isHttp && err?.code && err?.message) {
    // Có vẻ là lỗi từ Supabase
    normalized = fromSupabase(err, 400);
  }

  const errorObj = normalized || (isHttp ? err : new HttpError(500, err?.message || "Internal Server Error"));

  const status = errorObj.status ?? 500;

  const payload = {
    success: false,
    error: errorObj.message,
    code: errorObj.code,
    details: errorObj.details,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  };

  if (status >= 500) {
    console.error("[ERROR]", err);
  } else {
    console.warn("[WARN]", errorObj.message);
  }

  res.status(status).json(payload);
}
