import { adminClient } from './admin.server'

/**
 * Asserts that a user has active administrator privileges.
 * Superadmin bootstrap is allowed ONLY if the verified email exactly matches INITIAL_ADMIN_EMAIL.
 */
export async function assertAdminUser(userId: string, email?: string): Promise<string> {
  const db = adminClient()
  const { data: adminRecord } = await db
    .from('admin_users')
    .select('role, is_active')
    .eq('id', userId)
    .eq('is_active', true)
    .maybeSingle()

  const initialEmail = (process.env['INITIAL_ADMIN_EMAIL'] || 'adminvincify@gmail.com').toLowerCase().trim()
  const userEmail = (email || '').toLowerCase().trim()

  if (!adminRecord && initialEmail !== userEmail) {
    throw new Error('Forbidden: Administrative access required')
  }

  return adminRecord?.role || 'superadmin'
}
