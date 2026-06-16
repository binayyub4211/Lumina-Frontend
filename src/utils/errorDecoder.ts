import errorCodeData from "@/src/data/errorCodes.json";

export type StellarErrorType =
  | "account"
  | "authorization"
  | "contract"
  | "funding"
  | "network"
  | "operation"
  | "storage"
  | "transaction"
  | "unknown";

export type ErrorSeverity = "info" | "warning" | "error";

export interface ErrorCodeEntry {
  errorCode: string;
  errorType: StellarErrorType;
  severity: ErrorSeverity;
  userMessage: string;
  troubleshootingSteps: string[];
  documentationUrl: string | null;
}

export interface DecodedError extends ErrorCodeEntry {
  originalError: unknown;
  rawCode: string | null;
  isKnown: boolean;
}

export interface ErrorDecodeContext {
  accountId?: string;
  network?: string;
  transactionHash?: string;
  contractId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface UnknownErrorTelemetryPayload {
  code: string | null;
  message: string | null;
  source: string;
  context: ErrorDecodeContext;
}

export type UnknownErrorTelemetryReporter = (
  payload: UnknownErrorTelemetryPayload,
) => void | Promise<void>;

const ERROR_CODES = errorCodeData as Record<string, ErrorCodeEntry>;

const GENERIC_ERROR: ErrorCodeEntry = {
  errorCode: "unexpected_error",
  errorType: "unknown",
  severity: "error",
  userMessage: "Unexpected error: we could not complete this Stellar request.",
  troubleshootingSteps: [
    "Refresh the latest ledger state and try again.",
    "Check your wallet connection and selected network.",
    "Contact support if the problem continues.",
  ],
  documentationUrl: null,
};

const CONTRACT_ERROR_PATTERNS: Array<[RegExp, keyof typeof ERROR_CODES]> = [
  [/contract\s*error|hosterror.*contract|scerror.*contract/i, "contract_error"],
  [/storage\s*error|scerror.*storage|storage/i, "storage_error"],
  [/access\s*violation|unauthorized|not\s*authorized/i, "access_violation"],
  [/auth\s*error|authorization/i, "auth_error"],
  [/budget|cpu|memory|resource/i, "budget_exceeded"],
  [/wasm|vm|trap|panic/i, "wasm_vm_error"],
];

export function resolveError(
  error: unknown,
  context: ErrorDecodeContext = {},
  telemetryReporter?: UnknownErrorTelemetryReporter,
): DecodedError {
  const rawCode = extractStellarErrorCode(error);
  const normalizedCode = normalizeErrorCode(rawCode);
  const entry = normalizedCode ? ERROR_CODES[normalizedCode] : undefined;

  if (entry) {
    return hydrateDecodedError(entry, error, rawCode, context, true);
  }

  const inferredContractCode = inferContractErrorCode(error);
  if (inferredContractCode) {
    return hydrateDecodedError(
      ERROR_CODES[inferredContractCode],
      error,
      rawCode ?? inferredContractCode,
      context,
      true,
    );
  }

  reportUnknownError(error, rawCode, context, telemetryReporter);

  return hydrateDecodedError(GENERIC_ERROR, error, rawCode, context, false);
}

export function extractStellarErrorCode(error: unknown): string | null {
  if (typeof error === "string") {
    return findKnownCodeInText(error) ?? error;
  }

  if (!isRecord(error)) {
    return null;
  }

  const directCode = firstString(
    error.errorCode,
    error.code,
    error.name,
    error.type,
    error.title,
  );

  if (directCode && normalizeErrorCode(directCode)) {
    return directCode;
  }

  const extras = error.extras;
  if (isRecord(extras)) {
    const resultCodes = extras.result_codes ?? extras.resultCodes;

    if (isRecord(resultCodes)) {
      const operationCode = getOperationResultCode(resultCodes.operations);
      const transactionCode = firstString(
        resultCodes.transaction,
        resultCodes.transactionCode,
      );

      return operationCode ?? transactionCode ?? directCode ?? null;
    }
  }

  const response = error.response;
  if (isRecord(response)) {
    const responseCode = extractStellarErrorCode(response.data ?? response);
    if (responseCode) {
      return responseCode;
    }
  }

  const message = firstString(error.message, error.detail, directCode);
  return message ? findKnownCodeInText(message) ?? message : null;
}

export function normalizeErrorCode(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  const normalized = code
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_")
    .toLowerCase();

  return ERROR_CODES[normalized] ? normalized : null;
}

function hydrateDecodedError(
  entry: ErrorCodeEntry,
  originalError: unknown,
  rawCode: string | null,
  context: ErrorDecodeContext,
  isKnown: boolean,
): DecodedError {
  return {
    ...entry,
    userMessage: formatMessage(entry.userMessage, context),
    troubleshootingSteps: entry.troubleshootingSteps.map((step) =>
      formatMessage(step, context),
    ),
    originalError,
    rawCode,
    isKnown,
  };
}

function inferContractErrorCode(error: unknown) {
  const text = stringifyError(error);

  for (const [pattern, code] of CONTRACT_ERROR_PATTERNS) {
    if (pattern.test(text)) {
      return code;
    }
  }

  return null;
}

function getOperationResultCode(operations: unknown) {
  if (Array.isArray(operations)) {
    return operations.find((code): code is string => typeof code === "string");
  }

  return typeof operations === "string" ? operations : null;
}

function findKnownCodeInText(text: string) {
  const normalizedText = text.toLowerCase();

  return (
    Object.keys(ERROR_CODES).find((code) =>
      normalizedText.includes(code.toLowerCase()),
    ) ?? null
  );
}

function formatMessage(template: string, context: ErrorDecodeContext) {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = context[key];
    return value === undefined || value === null || value === ""
      ? placeholder
      : String(value);
  });
}

function reportUnknownError(
  error: unknown,
  code: string | null,
  context: ErrorDecodeContext,
  telemetryReporter?: UnknownErrorTelemetryReporter,
) {
  if (!telemetryReporter) {
    return;
  }

  void telemetryReporter({
    code,
    message: getErrorMessage(error),
    source: "stellar-error-decoder",
    context,
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error)) {
    return firstString(error.message, error.detail);
  }

  return typeof error === "string" ? error : null;
}

function stringifyError(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return `${error.name} ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
