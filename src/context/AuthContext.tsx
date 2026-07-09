import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
  type ReactNode,
} from 'react'
import type { Session, User, AuthError } from '@supabase/supabase-js'
import { supabase, extractError } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgContext {
  id: string
  name: string
  slug: string
  plan: string
  logo_url: string | null
}

export type AuthStatus =
  | 'initialising'  // haven't heard from Supabase yet
  | 'unauthenticated'
  | 'authenticated'
  | 'no_org'        // logged in but create_organization_for_user not yet called

export interface AuthState {
  status: AuthStatus
  user:   User | null
  org:    OrgContext | null
  error:  string | null
}

export interface AuthActions {
  login:         (email: string, password: string) => Promise<boolean>
  signup:        (email: string, password: string, instituteName: string) => Promise<boolean>
  logout:        () => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
  updatePassword:(password: string) => Promise<boolean>
  clearError:    () => void
  refreshOrg:    () => Promise<void>
}

type AuthContextValue = AuthState & AuthActions

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchOrg(userId: string): Promise<OrgContext | null> {
  console.log('[AUTH] fetchOrg() called', { userId })
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, plan, logo_url')
    .limit(1)
    .maybeSingle()

  console.log('[AUTH] fetchOrg() response', { data, error: error ?? null })
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as OrgContext | null
}

async function createOrg(
  userId: string,
  instituteName: string,
): Promise<OrgContext> {
  const { data, error } = await supabase.rpc('create_organization_for_user', {
    p_user_id:  userId,
    p_org_name: instituteName,
    p_org_slug: instituteName,
  })
  if (error) throw error
  // data = { organization_id, created }
  const org = await fetchOrg(userId)
  if (!org) throw new Error('Organisation created but could not be fetched')
  return org
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'initialising',
    user:   null,
    org:    null,
    error:  null,
  })

  // Prevent state updates after unmount
  const mounted = useRef(true)
  useEffect(() => { return () => { mounted.current = false } }, [])

  const set = useCallback((patch: Partial<AuthState>) => {
    if (mounted.current) setState(prev => ({ ...prev, ...patch }))
  }, [])

  // ── Resolve session → org on mount + auth state changes ──────────
  const resolveSession = useCallback(async (session: Session | null) => {
    console.log('[AUTH] resolveSession called', { userId: session?.user?.id ?? null })
    if (!session) {
      console.log('[AUTH] resolveSession → no session, setting unauthenticated')
      set({ status: 'unauthenticated', user: null, org: null, error: null })
      return
    }
    try {
      const org = await fetchOrg(session.user.id)
      console.log('[AUTH] resolveSession → fetchOrg result', { org })
      const newStatus = org ? 'authenticated' : 'no_org'
      console.log('[AUTH] resolveSession → setting status', newStatus)
      set({
        status: newStatus,
        user:   session.user,
        org,
        error:  null,
      })
    } catch (e) {
      console.log('[AUTH] resolveSession → fetchOrg threw', extractError(e))
      set({ status: 'authenticated', user: session.user, org: null, error: extractError(e) })
    }
  }, [set])

  useEffect(() => {
    // Supabase v2 recommended pattern (per official docs React Context example):
    // onAuthStateChange alone — INITIAL_SESSION fires on mount with the current
    // session from localStorage (no network round-trip), then SIGNED_IN/OUT etc.
    // for subsequent events. No getSession() needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AUTH] onAuthStateChange', event, { userId: session?.user?.id ?? null })
        if (event === 'INITIAL_SESSION') {
          resolveSession(session)
        } else if (event === 'SIGNED_IN') {
          resolveSession(session)
        } else if (event === 'SIGNED_OUT') {
          set({ status: 'unauthenticated', user: null, org: null, error: null })
        } else if (event === 'TOKEN_REFRESHED') {
          if (session) set({ user: session.user })
        } else if (event === 'USER_UPDATED') {
          if (session) set({ user: session.user })
        } else if (event === 'PASSWORD_RECOVERY') {
          if (session) set({ status: 'authenticated', user: session.user })
        }
      }
    )
    return () => subscription.unsubscribe()
  }, [resolveSession, set])

  // ── Actions ──────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    console.log('[AUTH] login() called')
    set({ error: null })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.log('[AUTH] login() signInWithPassword error', error.message)
      set({ error: (error as AuthError).message }); return false
    }
    console.log('[AUTH] login() signInWithPassword success — waiting for onAuthStateChange SIGNED_IN')
    return true
  }, [set])

  const signup = useCallback(async (
    email: string,
    password: string,
    instituteName: string,
  ): Promise<boolean> => {
    set({ error: null })

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) { set({ error: signUpError.message }); return false }

    const user = data.session?.user ?? data.user
    if (!user) {
      // Email confirmation required — Supabase returns no session
      set({
        status: 'unauthenticated',
        error:  'Check your email and click the confirmation link, then log in.',
      })
      // Return true — this is a success path, not a failure
      return true
    }

    // Atomic org creation — if this fails the user exists in auth
    // but has no org. They can retry login which will land on no_org screen.
    try {
      const org = await createOrg(user.id, instituteName)
      set({ status: 'authenticated', user, org, error: null })
      return true
    } catch (e) {
      set({
        status: 'no_org',
        user,
        org:   null,
        error: `Account created but institute setup failed: ${extractError(e)}. Please log in again to retry.`,
      })
      return false
    }
  }, [set])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    // onAuthStateChange fires and sets unauthenticated
  }, [])

  const resetPassword = useCallback(async (email: string): Promise<boolean> => {
    set({ error: null })
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { set({ error: error.message }); return false }
    return true
  }, [set])

  const updatePassword = useCallback(async (password: string): Promise<boolean> => {
    set({ error: null })
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { set({ error: error.message }); return false }
    return true
  }, [set])

  const clearError = useCallback(() => set({ error: null }), [set])

  const refreshOrg = useCallback(async () => {
    if (!state.user) return
    try {
      const org = await fetchOrg(state.user.id)
      set({ org, status: org ? 'authenticated' : 'no_org' })
    } catch (e) {
      set({ error: extractError(e) })
    }
  }, [state.user, set])

  const value: AuthContextValue = {
    ...state,
    login, signup, logout,
    resetPassword, updatePassword,
    clearError, refreshOrg,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
