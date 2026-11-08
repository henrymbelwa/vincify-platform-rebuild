import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authenticateToken, AuthError } from './auth-middleware'

describe('Security & Token Authentication Tests (auth-middleware)', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      SUPABASE_URL: 'https://mock-project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_mock_key_test',
      INITIAL_ADMIN_EMAIL: 'adminvincify@gmail.com',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('1. Valid Supabase token creates verified authenticated user', async () => {
    const mockUser = {
      id: 'd9b9a656-7875-407b-8c88-123456789abc',
      email: 'validuser@example.com',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    }

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    }

    const result = await authenticateToken('valid.jwt.token', undefined, undefined, mockClient)
    expect(result.user).toBeDefined()
    expect(result.user.id).toBe(mockUser.id)
    expect(result.user.email).toBe(mockUser.email)
  })

  it('2. Forged JWT with alg: none is rejected and creates NO user context', async () => {
    // Header: {"alg":"none","typ":"JWT"} -> eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0
    // Payload: {"sub":"attacker-id","email":"adminvincify@gmail.com","aud":"authenticated","exp":9999999999}
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: 'attacker-id',
        email: 'adminvincify@gmail.com',
        aud: 'authenticated',
        exp: 9999999999,
      }),
    ).toString('base64url')
    const forgedNoneToken = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${forgedPayload}.`

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid JWT signature: alg none not permitted', status: 401 },
        }),
      },
    }

    await expect(
      authenticateToken(forgedNoneToken, undefined, undefined, mockClient),
    ).rejects.toThrow(AuthError)

    await expect(
      authenticateToken(forgedNoneToken, undefined, undefined, mockClient),
    ).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('Invalid JWT signature'),
    })
  })

  it('3. Forged JWT claiming initial administrator email is rejected and does not bypass auth', async () => {
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000000',
        email: 'adminvincify@gmail.com',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url')
    const forgedAdminToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${forgedPayload}.forged_fake_signature`

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Signature verification failed', status: 401 },
        }),
      },
    }

    await expect(
      authenticateToken(forgedAdminToken, undefined, undefined, mockClient),
    ).rejects.toThrow(AuthError)

    await expect(
      authenticateToken(forgedAdminToken, undefined, undefined, mockClient),
    ).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('Signature verification failed'),
    })
  })

  it('4. Expired token is rejected with 401 and creates NO authenticated user', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'JWT expired', status: 401 },
        }),
      },
    }

    await expect(
      authenticateToken('expired.jwt.token', undefined, undefined, mockClient),
    ).rejects.toThrow(AuthError)

    await expect(
      authenticateToken('expired.jwt.token', undefined, undefined, mockClient),
    ).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('JWT expired'),
    })
  })

  it('5. Malformed token is rejected with 401 and creates NO authenticated user', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Malformed JWT', status: 401 },
        }),
      },
    }

    await expect(
      authenticateToken('this-is-not-a-valid-token', undefined, undefined, mockClient),
    ).rejects.toThrow(AuthError)

    await expect(
      authenticateToken('this-is-not-a-valid-token', undefined, undefined, mockClient),
    ).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('Malformed JWT'),
    })
  })

  it('6. Missing Authorization token throws 401 immediately', async () => {
    await expect(authenticateToken('')).rejects.toThrow(AuthError)
    await expect(authenticateToken('')).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('Missing bearer token'),
    })
  })

  it('7. Supabase Auth network failure fails closed with 503 and NEVER creates a user', async () => {
    // Even if token looks valid or has an admin payload:
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: 'attacker-id',
        email: 'adminvincify@gmail.com',
        aud: 'authenticated',
        exp: 9999999999,
      }),
    ).toString('base64url')
    const forgedToken = `header.${forgedPayload}.signature`

    const mockClient = {
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error('FetchError: connect ECONNREFUSED')),
      },
    }

    // MUST fail closed: no user returned, 503 status
    await expect(
      authenticateToken(forgedToken, undefined, undefined, mockClient),
    ).rejects.toThrow(AuthError)

    await expect(
      authenticateToken(forgedToken, undefined, undefined, mockClient),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('Failed to connect to Supabase Auth'),
    })
  })

  it('8. Supabase Auth explicit rejection fails closed with 401', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'User not found or token revoked', status: 401 },
        }),
      },
    }

    await expect(
      authenticateToken('revoked.jwt.token', undefined, undefined, mockClient),
    ).rejects.toThrow(AuthError)

    await expect(
      authenticateToken('revoked.jwt.token', undefined, undefined, mockClient),
    ).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('User not found or token revoked'),
    })
  })
})
