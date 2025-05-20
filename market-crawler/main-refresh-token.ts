import { getEnv } from "./helpers";
import { AuthTokenService } from "./refresh-token";

const sessionName = getEnv("ALT_SESSION_NAME")
if (!sessionName) {
  throw new Error("ALT_SESSION_NAME is not set");
}

const authTokenService = new AuthTokenService(sessionName);

const token = await authTokenService.getToken({ forceRefresh: true });

console.log(`[refresh-token-task] Token refreshed: ${token.token.slice(0, 20)}...[redacted] - Expires: ${token.expiresAt}`);