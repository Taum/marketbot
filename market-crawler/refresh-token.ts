import prisma from "@common/utils/prisma.server";
import { addHours, addMinutes, differenceInMinutes } from "date-fns";

export interface AuthToken {
  token: string;
  expiresAt: Date;
}

export class AuthTokenService {

  private _token: AuthToken | null = null;
  private _getTokenPromise: Promise<AuthToken> | null = null;

  constructor(private sessionName: string) {
  }

  async getToken(): Promise<AuthToken> {
    if (this._token && !this.expiredSoon(this._token.expiresAt)) {
      return this._token;
    }

    if (this._getTokenPromise) {
      return this._getTokenPromise;
    }

    // We cache the actual token refresh, so that multiple callers wait on the same promise
    // rather than each triggering their own refresh
    this._getTokenPromise = this._doGetToken();
    this._getTokenPromise.finally(() => this._getTokenPromise = null);
    return this._getTokenPromise;
  }

  private async _doGetToken(): Promise<AuthToken> {
    const session = await prisma.altggSession.findFirst({
      where: {
        name: this.sessionName,
      },
    });
    if (!session) {
      throw new Error(`Session ${this.sessionName} not found`);
    }
    if (session.accessToken != null && session.expiresAt != null && this.expiredSoon(session.expiresAt)) {
      const token = {
        token: session.accessToken,
        expiresAt: session.expiresAt,
      }
      this._token = token;
      return token;
    }

    // We don't have a token in DB or it's expired, let's refresh it
    const newToken = await refreshAccessToken(this.sessionName);
    if (newToken) {
      this._token = newToken
      return this._token;
    }

    throw new Error(`Failed to refresh token for session ${this.sessionName}`);
  }

  async getAuthorizationHeaders() {
    const token = await this.getToken();
    return {
      'Authorization': `Bearer ${token.token}`
    }
  }

  // Try to refresh token 10 min before it expires
  private expiredSoon(expiresAt: Date, now: Date = new Date()): boolean {
    const timeDiff = differenceInMinutes(expiresAt, now);
    return timeDiff < 10;
  }

}


interface RefreshCookies {
  name: string;
  value: string;
  expires?: string;
}

interface SessionResponse {
  expires: string
  accessToken: string
  userId: string
}

export async function refreshAccessToken(name: string, inCookies: RefreshCookies[] | null = null): Promise<AuthToken | null> {
  const session = await prisma.altggSession.findFirst({
    where: {
      name,
    },
    orderBy: {
      id: 'desc'
    }
  });

  if (!session) {
    throw new Error(`Session ${name} not found`);
  }

  const refreshCookies = inCookies ?? (session.refreshCookies as unknown as RefreshCookies[]);
  let cookies: string[] = [];
  refreshCookies.forEach((cookie) => {
    const expireDate = cookie.expires != null ? new Date(cookie.expires) : undefined;
    if (!expireDate || expireDate > new Date()) {
      cookies.push(`${cookie.name}=${cookie.value}`);
    }
  });
  cookies.push("__Secure-next-auth.callback-url=https%3A%2F%2Fwww.altered.gg")

  const headers = {
    'Cookie': cookies.join('; ')
  }
  const response = await fetch(`https://www.altered.gg/api/auth/session`, {
    headers,
  });
  const sessionResponse = await response.json() as SessionResponse
  
  if (sessionResponse.accessToken == null) {
    console.error("Failed to refresh token. Response:")
    console.dir(sessionResponse, { depth: null })
    return null
  }

  console.log("Refreshed access token => ", sessionResponse.accessToken.substring(0, 20) + "...[redacted]");

  const respCookies = response.headers.getSetCookie();
  // Log only cookie names
  console.log("Got back cookies: ", respCookies.map((c) => c.split(';')[0].split('=')[0]).join(', '));

  if (sessionResponse.accessToken != null && sessionResponse.expires) {
    const storedCookies = respCookies.map((c) => {
      const [name, value] = c.split(';')[0].split('=');
      const cExpiry = c.split('; ')
        .find((part) => part.split('=')[0].match('Expires'))
        ?.split('=')[1];
      return {
        name,
        value,
        expires: cExpiry,
      }
    }).filter((c) => c.name.startsWith("__Secure-next-auth.session-token."));
    
    // We enforce the Expiry at max 1 hour, to refresh the token earlier
    let expiresAtDate = new Date(sessionResponse.expires)
    const maxExpiry = addHours(new Date(), 1)
    if (expiresAtDate > maxExpiry) {
      console.log(`Original expires at ${expiresAtDate}, clamping to ${maxExpiry}`)
      expiresAtDate = maxExpiry
    }

    const blob = {
      accessToken: sessionResponse.accessToken,
      userId: sessionResponse.userId,
      expiresAt: expiresAtDate,
      refreshCookies: storedCookies,
    }
    await prisma.altggSession.update({
      where: {
        id: session.id,
      },
      data: blob,
    });

    return {
      token: sessionResponse.accessToken,
      expiresAt: expiresAtDate,
    };
  }

  return null
};


export async function findAuthToken(sessionName: string): Promise<string | null> {
  const session = await prisma.altggSession.findFirst({
    where: {
      name: sessionName,
    },
  });
  if (session && session.accessToken && session.expiresAt && session.expiresAt > new Date()) {
    return session.accessToken;
  }
  return null;
}
