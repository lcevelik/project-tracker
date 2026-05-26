import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

function CustomPrismaAdapter(): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    async createUser(user) {
      const created = await prisma.user.create({
        data: {
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          githubId: `pending-${Date.now()}`,
        },
      });
      return created as any;
    },
    async linkAccount(account: AdapterAccount) {
      if (account.provider === "github" && account.providerAccountId) {
        await prisma.user.update({
          where: { id: account.userId },
          data: { githubId: account.providerAccountId },
        });
      }
      if (base.linkAccount) {
        return base.linkAccount(account);
      }
      return account as any;
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: CustomPrismaAdapter() as any,
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
