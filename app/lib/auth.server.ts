import bcrypt from "bcryptjs";
import prisma from "@common/utils/prisma.server";
import { Authenticator } from "remix-auth";
import { GoogleStrategy } from "remix-auth-google";
import { sessionStorage } from "./session.server";
import type { User } from "@prisma/client";

// Define the user type for the authenticator
export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
};

// Create an instance of the authenticator
export const authenticator = new Authenticator<AuthUser>(sessionStorage);

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const googleStrategy = new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback",
    },
    async ({ profile }) => {
      // Check if user already exists
      let user: User | null = await prisma.user.findUnique({
        where: { email: profile.emails[0].value },
      });

      if (user) {
        // Update googleId if not set
        if (!user.googleId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { 
              googleId: profile.id,
              provider: "google",
            },
          });
        }
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: profile.emails[0].value,
            name: profile.displayName,
            googleId: profile.id,
            provider: "google",
          },
        });
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
      };
    }
  );

  authenticator.use(googleStrategy, "google");
}

export async function createUser(email: string, password: string, name?: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      provider: "local",
    },
  });
}

export async function verifyLogin(emailOrName: string, password: string) {
  // Try to find user by email first, then by name
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrName },
        { name: emailOrName },
      ],
    },
  });

  if (!user) {
    return null;
  }

  // Check if user has a password (local auth)
  if (!user.password) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return null;
  }

  return { id: user.id, email: user.email, name: user.name };
}

export async function getUserById(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      provider: true,
    },
  });
}
