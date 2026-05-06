import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function resolveAuthBaseURL() {
  return (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
}

const loginEnvelopeSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

const loginDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    _id: z.string(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    username: z.string().optional(),
    role: z.string().optional(),
    avatar: z
      .object({
        public_id: z.string().optional(),
        url: z.string().optional(),
      })
      .optional(),
  }),
});

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.role = user.role;
        token._id = user._id;
        token.user = user.user;
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.role = token.role as string;
      session._id = token._id as string;
      session.user = {
        ...session.user,
        ...(token.user as {
          _id: string;
          name?: string;
          email: string;
          username: string;
          role: string;
          avatar?: {
            public_id: string;
            url: string;
          };
        }),
      };

      return session;
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const baseURL = resolveAuthBaseURL();

        if (!baseURL) {
          throw new Error("Missing auth API URL. Set AUTH_API_BASE_URL or NEXT_PUBLIC_BASE_URL.");
        }

        let response: Response;
        try {
          response = await fetch(`${baseURL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(parsed.data),
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Unknown network error";
          throw new Error(`Unable to reach auth API at ${baseURL}. ${reason}. If you changed .env, restart the Next.js server.`);
        }

        const rawText = await response.text();
        let rawJson: unknown = {};

        try {
          rawJson = rawText ? JSON.parse(rawText) : {};
        } catch {
          throw new Error("Login API returned non-JSON response");
        }

        const parsedResponse = loginEnvelopeSchema.safeParse(rawJson);

        if (!parsedResponse.success) {
          throw new Error("Unexpected login response");
        }

        const json = parsedResponse.data;

        if (!response.ok || !json.success) {
          throw new Error(json.message || "Login failed");
        }

        const parsedData = loginDataSchema.safeParse(json.data);
        if (!parsedData.success) {
          throw new Error("Incomplete login response");
        }

        const loginData = parsedData.data;

        const normalizedUser = {
          _id: loginData.user._id,
          name: loginData.user.name || loginData.user.username || "User",
          email: loginData.user.email || parsed.data.email,
          username: loginData.user.username || loginData.user.name || "user",
          role: loginData.user.role || "user",
          avatar: loginData.user.avatar
            ? {
                public_id: loginData.user.avatar.public_id || "",
                url: loginData.user.avatar.url || "",
              }
            : undefined,
        };

        return {
          id: normalizedUser._id,
          _id: normalizedUser._id,
          accessToken: loginData.accessToken,
          refreshToken: loginData.refreshToken,
          role: normalizedUser.role,
          user: normalizedUser,
          email: normalizedUser.email,
          name: normalizedUser.name,
        };
      },
    }),
  ],
};
