import NextAuth, { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/db'
import { createAuthAdapter } from './adapter'
import { authorizeWithPassword } from './credentials'
import { isSessionRevoked, SessionRevokedError } from './session-revocation'
import { requireSecondFactorIfEnabled } from './two-factor'
import { authorizeWithSecondFactor, googleSignInGate } from './two-factor-login'
import { TWO_FACTOR_PROVIDER } from './two-factor-shared'
import { createDefaultWorkspace } from './default-workspace'

export { getServerSession }

export const authOptions: NextAuthOptions = {
  // Stores no OAuth tokens: see ./adapter.ts
  adapter: createAuthAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
  },
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    // Credentials Provider (Username/Password login)
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Tên đăng nhập', type: 'text' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      // Brute-force limits and account lock: see ./credentials.ts
      async authorize(credentials, req) {
        const user = await authorizeWithPassword(credentials, req?.headers)
        // Two-factor on: no session yet, the login page asks for the code.
        await requireSecondFactorIfEnabled(user.id, 'password')
        return user
      },
    }),
    // Second step of a sign-in with two-factor on: see ./two-factor.ts
    CredentialsProvider({
      id: TWO_FACTOR_PROVIDER,
      name: TWO_FACTOR_PROVIDER,
      credentials: {
        challenge: { type: 'text' },
        code: { label: 'Mã xác thực', type: 'text' },
      },
      async authorize(credentials, req) {
        return authorizeWithSecondFactor(credentials, req?.headers)
      },
    }),
  ],
  callbacks: {
    // Google with two-factor on: no session yet, send the user to the code step.
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true
      return googleSignInGate(account, user.email)
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        // Sign-in time, compared with password changes (session-revocation.ts).
        token.authTime = Date.now()
      }

      // Throwing here makes next-auth clear the cookie: the user is signed out.
      if (token.id && (await isSessionRevoked(token.id as string, Number(token.authTime ?? 0)))) {
        throw new SessionRevokedError()
      }

      // Session update (useSession().update()): reload from the database and
      // ignore whatever the client sent. next-auth passes the body of
      // POST /api/auth/session straight in as `session`, and token.email is
      // used for authorization (booking guest and invitation checks), so
      // copying it let any user claim any email.
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true, image: true },
        })
        if (fresh) {
          token.name = fresh.name
          token.email = fresh.email
          token.image = fresh.image
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session || null
    },
  },
  events: {
    // Only next-auth's adapter makes users here (a first Google sign-in); the
    // sign-up form makes its own workspace (api/auth/register).
    async createUser({ user }) {
      await createDefaultWorkspace(user.id, user.name || user.email || 'Digistay').catch((error) =>
        console.error('[auth] default workspace for a Google account failed:', error),
      )
    },
    async signIn({ user }) {
      console.log('User signed in:', user.email)
    },
  },
}

// For API routes
export { authOptions as config }

// For server components - get session directly
export async function auth() {
  return getServerSession(authOptions)
}
