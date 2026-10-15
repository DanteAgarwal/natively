// ---------------------------------------------------------------------------
// Model Registry — Error Normalizer
// PRD §6.5 FR-24, FR-25, §10 SEC-06
//
// Converts heterogeneous HTTP/SDK errors into NormalizedError with
// classification, retry-after extraction, and secret sanitization.
// ---------------------------------------------------------------------------

import { NormalizedError } from './types';
import { ObservabilityRedactor } from '../diagnostics';

export function normalizeStandardError(error: any): NormalizedError {
  if (!error) {
    return {
      errorClass: 'UNKNOWN',
      isTransient: false,
      message: 'Unknown error occurred',
    };
  }

  const rawMessage = error.message || String(error);
  const status = error.status || error.statusCode || error.response?.status;
  const message = ObservabilityRedactor.redactText(rawMessage);

  // Extract Retry-After if available (header or body message)
  let retryAfterMs: number | undefined;
  const headers = error.response?.headers || error.headers;
  if (headers) {
    const headerVal = headers['retry-after'] || headers['Retry-After'];
    if (headerVal) {
      const parsed = parseInt(String(headerVal), 10);
      if (!isNaN(parsed) && parsed > 0) {
        retryAfterMs = parsed * 1000;
      }
    }
  }

  // Regex fallback for text like "try again in 12s" or "rate limit exceeded, wait 4.5s"
  if (!retryAfterMs) {
    const match = rawMessage.match(/try again in ([0-9.]+)\s*s/i) ||
                  rawMessage.match(/wait ([0-9.]+)\s*s/i);
    if (match) {
      const seconds = parseFloat(match[1]);
      if (!isNaN(seconds) && seconds > 0) {
        retryAfterMs = Math.round(seconds * 1000);
      }
    }
  }

  // 1. Rate Limit (429)
  if (status === 429 || /rate limit|quota|429/i.test(rawMessage)) {
    return {
      errorClass: 'RATE_LIMIT_429',
      statusCode: 429,
      retryAfterMs,
      isTransient: true,
      message: `Rate limit or quota exceeded: ${message}`,
      rawError: error,
    };
  }

  // 2. Auth error (401 / 403)
  if (status === 401 || status === 403 || /unauthorized|api key|forbidden|auth/i.test(rawMessage)) {
    return {
      errorClass: 'AUTH_ERROR_401',
      statusCode: status || 401,
      isTransient: false,
      message: `Authentication or permission failure: ${message}`,
      rawError: error,
    };
  }

  // 3. Model not found (404)
  if (status === 404 || /not found|unknown model|model.*does not exist/i.test(rawMessage)) {
    return {
      errorClass: 'NOT_FOUND_404',
      statusCode: 404,
      isTransient: false,
      message: `Model not found or decommissioned: ${message}`,
      rawError: error,
    };
  }

  // 4. Invalid request (400)
  if (status === 400 || /bad request|invalid payload|invalid parameter/i.test(rawMessage)) {
    return {
      errorClass: 'INVALID_REQUEST_400',
      statusCode: 400,
      isTransient: false,
      message: `Invalid request payload or modality: ${message}`,
      rawError: error,
    };
  }

  // 5. Timeout
  if (/timeout|timed out|abort/i.test(rawMessage)) {
    return {
      errorClass: 'TIMEOUT',
      statusCode: 408,
      isTransient: true,
      message: `Request timed out: ${message}`,
      rawError: error,
    };
  }

  // 6. Network error
  if (/econnrefused|enotfound|network error|fetch failed/i.test(rawMessage)) {
    return {
      errorClass: 'NETWORK_ERROR',
      isTransient: true,
      message: `Network connectivity error: ${message}`,
      rawError: error,
    };
  }

  // 7. Server error (5xx)
  if (status >= 500 && status < 600) {
    return {
      errorClass: 'SERVER_ERROR_5XX',
      statusCode: status,
      isTransient: true,
      message: `Provider server error (${status}): ${message}`,
      rawError: error,
    };
  }

  return {
    errorClass: 'UNKNOWN',
    statusCode: status,
    isTransient: false,
    message,
    rawError: error,
  };
}
