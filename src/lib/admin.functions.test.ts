import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock admin client
vi.mock('./server/admin.server', () => {
  return {
    adminClient: vi.fn(),
  }
})

import { assertAdminUser } from './server/admin-auth.server'
import { adminClient } from './server/admin.server'

describe('Administrator Privilege & Authorization Security Tests', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = {
      ...originalEnv,
      INITIAL_ADMIN_EMAIL: 'adminvincify@gmail.com',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('1. Ordinary user attempting administrator access is rejected with Forbidden', async () => {
    // Normal user with no admin_users record and different email
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          return {
            eq: vi.fn().mockImplementation((col2: string, val2: any) => {
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }
            }),
          }
        }),
      }),
    }
    vi.mocked(adminClient).mockReturnValue(mockDb as any)

    await expect(
      assertAdminUser('user-uuid-123', 'regularuser@example.com'),
    ).rejects.toThrow('Forbidden: Administrative access required')
  })

  it('2. Verified existing administrator accessing protected functions succeeds', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          return {
            eq: vi.fn().mockImplementation((col2: string, val2: any) => {
              return {
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'admin', is_active: true },
                  error: null,
                }),
              }
            }),
          }
        }),
      }),
    }
    vi.mocked(adminClient).mockReturnValue(mockDb as any)

    const role = await assertAdminUser('admin-uuid-456', 'existingadmin@example.com')
    expect(role).toBe('admin')
  })

  it('3. Initial superadmin bootstrap requires exact matching of initial email', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          return {
            eq: vi.fn().mockImplementation((col2: string, val2: any) => {
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }
            }),
          }
        }),
      }),
    }
    vi.mocked(adminClient).mockReturnValue(mockDb as any)

    // Exact initial admin email allows bootstrapping
    const role = await assertAdminUser('superadmin-uuid-789', 'adminvincify@gmail.com')
    expect(role).toBe('superadmin')

    // Different email must fail
    await expect(
      assertAdminUser('superadmin-uuid-789', 'adminvincify@otherdomain.com'),
    ).rejects.toThrow('Forbidden: Administrative access required')
  })

  it('4. Bootstrap normalizes email casing and whitespace', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          return {
            eq: vi.fn().mockImplementation((col2: string, val2: any) => {
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }
            }),
          }
        }),
      }),
    }
    vi.mocked(adminClient).mockReturnValue(mockDb as any)

    // Mixed casing and whitespace matches normalized initial email
    const role = await assertAdminUser('superadmin-uuid-789', '  AdminVincify@Gmail.COM  ')
    expect(role).toBe('superadmin')
  })

  it('5. Inactive administrator is rejected even if record exists', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          return {
            eq: vi.fn().mockImplementation((col2: string, val2: any) => {
              // When is_active=true is queried, inactive user returns null
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }
            }),
          }
        }),
      }),
    }
    vi.mocked(adminClient).mockReturnValue(mockDb as any)

    await expect(
      assertAdminUser('deactivated-admin', 'formeradmin@example.com'),
    ).rejects.toThrow('Forbidden: Administrative access required')
  })
})
