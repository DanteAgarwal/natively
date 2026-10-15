// ---------------------------------------------------------------------------
// Model Registry — Error Normalizer
// PRD §6.5 FR-24, FR-25, §10 SEC-06
//
// Converts heterogeneous HTTP/SDK errors into NormalizedError with
// classification, retry-after extraction, and secret sanitization.
// ---------------------------------------------------------------------------

import { NormalizedError } from './types';
import { ObservabilityRedactor } from '../diagnostics';

function extractCleanErrorMessage(raw: string): string {
  if (!raw) return 'Unknown error occurred';

  // Check if raw contains a JSON object
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      let innerMsg = parsed.error?.message || parsed.message;
      if (typeof innerMsg === 'string') {
        innerMsg = innerMsg.trim();
        // Check if inner message is itself JSON-encoded string
        if (innerMsg.startsWith('{')) {
          try {
            const doubleParsed = JSON.parse(innerMsg);
            if (doubleParsed.error?.message) {
              innerMsg = doubleParsed.error.message.trim();
            }
          } catch {}
        }
        return innerMsg;
      }
    } catch {}
  }

  // Strip prefixes like "got status: 503 Service Unavailable."
  return raw
    .replace(/^got status: \d+ [^.]+\.\s*/i, '')
    .replace(/^[a-zA-Z]+Error:\s*/i, '')
    .trim();
}

export function normalizeStandardError(error: any): NormalizedError {
  if (!error) {
    return {
      errorClass: 'UNKNOWN',
      isTransient: false,
      message: 'Unknown error occurred',
    };
  }

  const rawMessage = error.message || String(error);
  let status = error.status || error.statusCode || error.response?.status || error.code;
  if (!status || typeof status !== 'number') {
    const statusMatch = rawMessage.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);
    if (statusMatch) {
      status = parseInt(statusMatch[1], 10);
    }
  }

  const cleanMessage = ObservabilityRedactor.redactText(extractCleanErrorMessage(rawMessage));

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
      message: `Rate limit or quota exceeded: ${cleanMessage}`,
      rawError: error,
    };
  }

  // 2. Auth error (401 / 403)
  if (status === 401 || status === 403 || /unauthorized|api key|forbidden|auth/i.test(rawMessage)) {
    return {
      errorClass: 'AUTH_ERROR_401',
      statusCode: status || 401,
      isTransient: false,
      message: `Authentication or permission failure: ${cleanMessage}`,
      rawError: error,
    };
  }

  // 3. Model not found (404)
  if (status === 404 || /not found|unknown model|model.*does not exist/i.test(rawMessage)) {
    return {
      errorClass: 'NOT_FOUND_404',
      statusCode: 404,
      isTransient: false,
      message: `Model not found or decommissioned: ${cleanMessage}`,
      rawError: error,
    };
  }

  // 4. Invalid request (400)
  if (status === 400 || /bad request|invalid payload|invalid parameter/i.test(rawMessage)) {
    return {
      errorClass: 'INVALID_REQUEST_400',
      statusCode: 400,
      isTransient: false,
      message: `Invalid request payload or modality: ${cleanMessage}`,
      rawError: error,
    };
  }

  // 5. Timeout
  if (/timeout|timed out|abort/i.test(rawMessage)) {
    return {
      errorClass: 'TIMEOUT',
      statusCode: 408,
      isTransient: true,
      message: `Request timed out: ${cleanMessage}`,
      rawError: error,
    };
  }

  // 6. Network error
  if (/econnrefused|enotfound|network error|fetch failed/i.test(rawMessage)) {
    return {
      errorClass: 'NETWORK_ERROR',
      isTransient: true,
      message: `Network connectivity error: ${cleanMessage}`,
      rawError: error,
    };
  }

  // 7. Server error (5xx)
  if (
    (status >= 500 && status < 600) ||
    /503|500|502|504|service unavailable|internal server error|high demand|overloaded|spikes in demand/i.test(rawMessage)
  ) {
    return {
      errorClass: 'SERVER_ERROR_5XX',
      statusCode: status || 503,
      isTransient: true,
      message: `Provider server error (${status || 503}): ${cleanMessage}`,
      rawError: error,
    };
  }

  return {
    errorClass: 'UNKNOWN',
    statusCode: status,
    isTransient: false,
    message: cleanMessage,
    rawError: error,
  };
}
