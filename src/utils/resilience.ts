
import CircuitBreaker from "opossum";
import { logger } from "./logger";

type AsyncOperation<T> = () => Promise<T>;

interface ErrorWithDetails {
  statusCode?: unknown;
  status?: unknown;
  code?: unknown;
  response?: {
    status?: unknown;
  };
}

const breakers = new Map<string, CircuitBreaker>();

const breakerOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 10,

  // Erros esperados de autenticação não devem abrir o circuito.
  errorFilter: (error: Error) => isExpectedClientError(error),
};

// Códigos que representam erros de negócio e não devem ser repetidos.
const nonRetryableCodes = new Set([
  "INVALID_CREDENTIALS",
  "USER_DISABLED",
  "MISSING_FIELDS",
  "INVALID_EMAIL",
  "NO_PASSWORD",
]);

function getErrorDetails(error: unknown): ErrorWithDetails {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  return error as ErrorWithDetails;
}

function getHttpStatus(error: unknown): number | undefined {
  const details = getErrorDetails(error);

  const possibleStatuses = [
    details.statusCode,
    details.status,
    details.response?.status,
  ];

  for (const status of possibleStatuses) {
    if (typeof status === "number") {
      return status;
    }
  }

  return undefined;
}

function getErrorCode(error: unknown): string | undefined {
  const code = getErrorDetails(error).code;

  return typeof code === "string" ? code : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isExpectedClientError(error: unknown): boolean {
  const status = getHttpStatus(error);
  const code = getErrorCode(error);

  // Erros HTTP 4xx não indicam necessariamente falha do serviço.
  if (
    status !== undefined &&
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  ) {
    return true;
  }

  return code !== undefined && nonRetryableCodes.has(code);
}

function isRetryableError(error: unknown): boolean {
  const status = getHttpStatus(error);
  const code = getErrorCode(error);

  // Não repetir chamadas quando o circuito já está aberto
  // ou quando o breaker foi encerrado.
  if (code === "EOPENBREAKER" || code === "ESHUTDOWN") {
    return false;
  }

  // Credenciais inválidas e outros erros de negócio não precisam de retry.
  if (isExpectedClientError(error)) {
    return false;
  }

  if (status !== undefined) {
    // Timeout, limite de requisições e erros do servidor
    // podem ser temporários.
    return status === 408 || status === 429 || status >= 500;
  }

  // Erros sem status HTTP, como falhas de rede,
  // podem ser temporários.
  return true;
}

/**
 * Obtém ou cria um Circuit Breaker por operação.
 *
 * A operação é passada pelo fire(), evitando alterar
 * a propriedade interna action do Opossum.
 */
function getBreaker(operationName: string): CircuitBreaker {
  let breaker = breakers.get(operationName);

  if (!breaker) {
    breaker = new CircuitBreaker(
      (operation: AsyncOperation<unknown>) => operation(),
      breakerOptions
    );

    breaker.on("open", () => {
      logger.error(
        `Circuit Breaker ABERTO para: ${operationName}`
      );
    });

    breaker.on("halfOpen", () => {
      logger.warn(
        `Circuit Breaker MEIO-ABERTO para: ${operationName}`
      );
    });

    breaker.on("close", () => {
      logger.info(
        `Circuit Breaker FECHADO para: ${operationName}`
      );
    });

    breakers.set(operationName, breaker);
  }

  return breaker;
}

/**
 * Executa uma operação com:
 * - Circuit Breaker
 * - Timeout
 * - Retry com backoff exponencial
 *
 * Preserva o erro original quando as tentativas falham.
 */
export async function executeWithResilience<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3
): Promise<T> {
  const totalAttempts = Math.max(1, Math.floor(maxRetries));
  const breaker = getBreaker(operationName);

  let lastError: unknown;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return (await breaker.fire(operation)) as T;
    } catch (error) {
      lastError = error;

      // Não repetir erros de autenticação ou outros erros definitivos.
      if (!isRetryableError(error)) {
        logger.warn(
          `Operação ${operationName} encerrada sem retry: ${getErrorMessage(error)}`
        );

        throw error;
      }

      if (attempt < totalAttempts) {
        logger.warn(
          `Tentativa ${attempt}/${totalAttempts} falhou para ${operationName}: ${getErrorMessage(error)}`
        );

        // Backoff exponencial: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000;

        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error(
          `Operação ${operationName} falhou após ${totalAttempts} tentativas: ${getErrorMessage(error)}`
        );
      }
    }
  }

  // Preserva o erro original, inclusive AppError e seu status HTTP.
  throw lastError;
}

/**
 * Encerramento dos Circuit Breakers.
 */
export function shutdownResilience(): void {
  for (const breaker of breakers.values()) {
    breaker.shutdown();
  }

  breakers.clear();
}
