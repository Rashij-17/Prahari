import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../services/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Helper to generate a dummy JWT token for offline testing
  const getMockToken = () => {
    const cleanB64 = (str) => btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const header = cleanB64(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    const payload = cleanB64(JSON.stringify({ 
      sub: "mock_user_12345", 
      email: "demo-patient@prahari.org",
      name: "Demo Patient"
    }))
    // "mocksignature123" has a length of 16, which is a multiple of 4, ensuring valid base64 padding
    return `${header}.${payload}.mocksignature123`
  }

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // 1. Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })

      // 2. Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })

      return () => subscription.unsubscribe()
    } else {
      // Local/Offline mock mode: check if mock session is logged in
      const mockLoggedIn = localStorage.getItem('prahari_mock_logged_in') === 'true'
      if (mockLoggedIn) {
        setUser({
          id: "mock_user_12345",
          email: "demo-patient@prahari.org",
          user_metadata: {
            full_name: "Demo Patient",
            avatar_url: "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Prahari"
          }
        })
        setSession({
          access_token: getMockToken()
        })
      } else {
        setUser(null)
        setSession(null)
      }
      setLoading(false)
    }
  }, [])

  const loginWithGoogle = async () => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) console.error("Google login error:", error.message)
    } else {
      // Toggle back to logged in
      localStorage.setItem('prahari_mock_logged_in', 'true')
      setUser({
        id: "mock_user_12345",
        email: "demo-patient@prahari.org",
        user_metadata: {
          full_name: "Demo Patient",
          avatar_url: "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=Prahari"
        }
      })
      setSession({
        access_token: getMockToken()
      })
    }
  }

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    } else {
      // Mock logout
      localStorage.setItem('prahari_mock_logged_in', 'false')
      setUser(null)
      setSession(null)
    }
  }

  const token = session?.access_token || null

  return (
    <AuthContext.Provider value={{ user, token, loading, loginWithGoogle, logout, isDemo: !isSupabaseConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
