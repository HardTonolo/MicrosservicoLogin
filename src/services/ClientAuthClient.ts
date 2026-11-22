
import axios, { AxiosError, AxiosInstance } from "axios";
import { env } from "../config/env";
import { executeWithResilience } from "../utils/resilience";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

interface ClientAuthResponse {
  id: number;
  email: string;
  nome: string | null;
  permissao: string;
  ativo: boolean;
}

interface BackendErrorResponse {
  error?: string;
  code?: string;
}

export class ClientAuthClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.BACKEND_MAIN_URL,
      timeout: 4500,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": env.INTERNAL_API_KEY,
      },
    });
  }

  async validateCredentials(
    email: string,
    senha: string
  ): Promise<ClientAuthResponse> {
    return executeWithResilience(
      async () => {
        try {
          const { data } = await this.http.post<ClientAuthResponse>(
            "/internal/client-auth",
            { email, senha }
          );

          return data;
        } catch (error: unknown) {
          if (!axios.isAxiosError(error)) {
            const message =
              error instanceof Error ? error.message : String(error);

            logger.error(
              `Erro inesperado ao chamar backend: ${message}`
            );

            throw new AppError(
              "Erro inesperado ao validar credenciais",
              500,
              "INTERNAL_ERROR"
            );
          }

          // Tipagem explícita para os dados da resposta Axios.
          const axiosError =
            error as AxiosError<BackendErrorResponse>;

          const status = axiosError.response?.status;
          const backendCode = axiosError.response?.data?.code;

          if (backendCode === "INVALID_CREDENTIALS") {
            throw new AppError(
              "Email ou senha inválidos",
              401,
              "INVALID_CREDENTIALS"
            );
          }

          if (backendCode === "USER_DISABLED") {
            throw new AppError(
              "Usuário desativado. Contate o administrador.",
              403,
              "USER_DISABLED"
            );
          }

          if (
            backendCode === "MISSING_API_KEY" ||
            backendCode === "INVALID_API_KEY"
          ) {
            logger.error(
              `Falha na autenticação interna entre serviços: ${backendCode}`
            );

            throw new AppError(
              "Falha na configuração da comunicação entre os serviços.",
              500,
              "INTERNAL_AUTH_CONFIG_ERROR"
            );
          }

          if (backendCode === "MISSING_FIELDS") {
            throw new AppError(
              "Falha na comunicação entre os serviços.",
              502,
              "INTERNAL_REQUEST_INVALID"
            );
          }

          if (backendCode === "NO_PASSWORD") {
            throw new AppError(
              "Usuário sem senha cadastrada.",
              400,
              "NO_PASSWORD"
            );
          }

          if (status === 404) {
            logger.error(
              "Endpoint interno não encontrado. Verifique BACKEND_MAIN_URL."
            );

            throw new AppError(
              "Endpoint de autenticação do backend não encontrado.",
              502,
              "BACKEND_ENDPOINT_NOT_FOUND"
            );
          }

          if (
            !axiosError.response ||
            (status !== undefined && status >= 500) ||
            status === 408 ||
            status === 429
          ) {
            logger.error(
              `Backend indisponível. Status: ${status ?? "sem resposta"}. Erro: ${axiosError.message}`
            );

            throw new AppError(
              "Serviço de autenticação indisponível. Tente novamente.",
              503,
              "BACKEND_UNAVAILABLE"
            );
          }

          logger.error(
            `Resposta inesperada do backend. Status: ${status ?? "desconhecido"}. Código: ${backendCode ?? "sem código"}`
          );

          throw new AppError(
            "Resposta inesperada do serviço de autenticação.",
            502,
            "BACKEND_AUTH_UNEXPECTED_RESPONSE"
          );
        }
      },
      "ClientAuth_ValidateCredentials"
    );
  }
}
