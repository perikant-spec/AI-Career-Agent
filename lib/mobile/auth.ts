import { SignJWT, jwtVerify } from "jose";

// Mobile has no browser cookie jar to carry a NextAuth session, so it authenticates with a
// bearer JWT instead — signed with the same AUTH_SECRET the web app already requires, not a
// separate credential to manage. 30 days, no refresh flow: a pragmatic MVP scope call, same as
// this build's other "manual timer, not a full scheduler" simplifications elsewhere.
const TOKEN_TTL = "30d";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set — required for mobile token signing.");
  return new TextEncoder().encode(secret);
}

export async function signMobileToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyMobileToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
}
