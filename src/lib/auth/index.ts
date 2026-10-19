import NextAuth, { NextAuthOptions, getServerSession } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export { getServerSession }

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
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
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu')
        }

        const username = credentials.username as string
        const password = credentials.password as string

        // Find user by username or email
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: username },
              { email: username },
            ],
          },
        })

        if (!user || !user.password) {
          throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác')
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
          throw new Error('Tên đăng nhập hoặc mật khẩu không chính xác')
        }

        // Require email verification
        if (!user.emailVerified) {
          throw new Error('Vui lòng xác thực email trước khi đăng nhập. Kiểm tra hộp thư đến của bạn.')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = user.role
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
    async createUser({ user }) {
      console.log('New user created:', user.email)
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
