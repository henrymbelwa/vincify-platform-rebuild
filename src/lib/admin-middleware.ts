import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireUser } from './auth-middleware'
import { adminClient } from './server/admin.server'

/**
 * Server function to check if the authenticated user has active admin privileges.
 * Also provisions the initial administrator and verifies if a mandatory password change is pending.
 */
export const checkIsAdmin = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const { user } = context
    const db = adminClient()

    // 1. Check existing database role
    const { data: adminRecord } = await db
      .from('admin_users')
      .select('role, is_active, must_change_password')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (adminRecord) {
      return {
        isAdmin: true,
        role: adminRecord.role as string,
        mustChangePassword: Boolean(adminRecord.must_change_password),
      }
    }

    // 2. Strict bootstrap check: only provision if email exactly matches INITIAL_ADMIN_EMAIL
    const initialEmail = (process.env['INITIAL_ADMIN_EMAIL'] || 'adminvincify@gmail.com').toLowerCase().trim()
    const userEmail = (user.email || '').toLowerCase().trim()

    if (initialEmail && userEmail === initialEmail) {
      // Auto-provision initial superadmin with mandatory password change flag set to true
      const { error: upsertErr } = await db.from('admin_users').upsert(
        {
          id: user.id,
          role: 'superadmin',
          is_active: true,
          must_change_password: true,
        },
        { onConflict: 'id' },
      )

      if (upsertErr) {
        console.error('[checkIsAdmin] Failed to bootstrap superadmin:', upsertErr)
        throw new Error(`Superadmin bootstrap failed: ${upsertErr.message}`)
      }

      const { error: auditErr } = await db.from('admin_audit_logs').insert({
        admin_id: user.id,
        admin_email: user.email,
        action: 'BOOTSTRAP_SUPERADMIN',
        target_type: 'admin_users',
        target_id: user.id,
        details: { reason: 'Initial superadmin account provisioned with mandatory password change requirement' },
      })

      if (auditErr) {
        console.warn('[checkIsAdmin] Non-fatal: Failed to write bootstrap audit log:', auditErr)
      }

      return {
        isAdmin: true,
        role: 'superadmin',
        mustChangePassword: true,
      }
    }

    return { isAdmin: false, role: null, mustChangePassword: false }
  })

/**
 * Completes the mandatory initial password change for an administrator.
 * Updates password via admin auth, records audit log, and clears must_change_password.
 */
export const completeAdminPasswordChange = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        newPassword: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .max(100)
          .regex(/[A-Z]/, 'Password must contain an uppercase letter')
          .regex(/[0-9]/, 'Password must contain a number'),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { user } = context
    const db = adminClient()

    // Verify admin status
    const { data: adminRecord } = await db
      .from('admin_users')
      .select('role, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    const initialEmail = (process.env['INITIAL_ADMIN_EMAIL'] || 'adminvincify@gmail.com').toLowerCase().trim()
    const userEmail = (user.email || '').toLowerCase().trim()

    if (!adminRecord && userEmail !== initialEmail) {
      throw new Error('Forbidden: Administrative authorization required')
    }

    // Update password in Supabase Auth securely via service-role
    const { error: authErr } = await db.auth.admin.updateUserById(user.id, {
      password: data.newPassword,
    })

    if (authErr) throw new Error(authErr.message)

    // Clear must_change_password flag and record timestamp
    await db
      .from('admin_users')
      .update({
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    // Audit log
    await db.from('admin_audit_logs').insert({
      admin_id: user.id,
      admin_email: user.email,
      action: 'ADMIN_PASSWORD_ROTATED',
      target_type: 'admin_users',
      target_id: user.id,
      details: { message: 'Initial temporary password replaced with permanent password' },
    })

    return { ok: true }
  })
