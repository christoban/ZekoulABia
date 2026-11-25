'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'
import { ROLE_CONFIG, type AccountChoice, type LoginData, type LoginStep } from './loginConfig'
import type { OtpInitPayload } from './useOtpMfaFlow'

interface UseCredentialsAuthParams {
  checkingSession: boolean
  onSuccessLogin: (data: LoginData) => void
  onOtpRequired: (data: OtpInitPayload) => void
  onGoToStep: (step: LoginStep) => void
}

export function useCredentialsAuth({
  checkingSession,
  onSuccessLogin,
  onOtpRequired,
  onGoToStep,
}: UseCredentialsAuthParams) {
  const t = useT('common')
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'warning' } | null>(null)
  const [suspended, setSuspended] = useState<{ schoolName: string } | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  // ── Multi-account choice ──
  const [accountChoices, setAccountChoices] = useState<AccountChoice[] | null>(null)
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null)

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotDone, setForgotDone] = useState(false)
  const [forgotError, setForgotError] = useState('')

  useEffect(() => {
    if (!checkingSession) {
      emailRef.current?.focus()
    }
  }, [checkingSession])

  // Empêcher le remplissage automatique du navigateur
  useEffect(() => {
    const tmr = setTimeout(() => {
      setEmail('')
      setPassword('')
    }, 50)
    return () => clearTimeout(tmr)
  }, [])

  const submitCredentials = async () => {
    setAlert(null)
    setSuspended(null)
    if (!email.trim() || !password) {
      setAlert({ msg: t('login.alert_required'), type: 'error' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })

      const data = await res.json()

      if (res.status === 403 && data.error === 'SCHOOL_SUSPENDED') {
        setSuspended({ schoolName: data.schoolName ?? 'Établissement' })
        return
      }

      if (res.status === 409 && data.code === 'MULTIPLE_ACCOUNTS') {
        setPendingCredentials({ email: email.trim().toLowerCase(), password })
        setAccountChoices(data.accounts)
        onGoToStep('choose_account')
        return
      }

      if (res.status === 422 && data.code === 'ROLE_MISMATCH_MULTIPLE') {
        setAlert({ msg: data.message ?? 'Rôle invalide', type: 'error' })
        return
      }

      if (!data.success) {
        setAlert({ msg: data.message ?? 'Email ou mot de passe incorrect', type: 'error' })
        return
      }

      if (data.step === 'done') {
        onSuccessLogin(data.data)
        return
      }

      onOtpRequired(data)
    } catch {
      try {
        const raw = localStorage.getItem('zekoulabia_user')
        if (raw) {
          const parsed = JSON.parse(raw)
          const dest = parsed?.role ? ROLE_CONFIG[parsed.role]?.dest : null
          if (dest) {
            router.replace(dest)
            return
          }
        }
      } catch {
        /* ignore */
      }
      setAlert({ msg: t('messages.networkError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const submitAccountChoice = async (account: AccountChoice) => {
    if (!pendingCredentials) return
    setLoading(true)
    setAlert(null)
    try {
      const res = await fetch('/api/v2/users/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: pendingCredentials.email,
          password: pendingCredentials.password,
          userId: account.userId,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setAlert({ msg: data.message ?? 'Erreur', type: 'error' })
        return
      }
      setAccountChoices(null)
      setPendingCredentials(null)
      if (data.step === 'done') {
        onSuccessLogin(data.data)
        return
      }
      onOtpRequired(data)
    } catch {
      setAlert({ msg: t('messages.networkError'), type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async () => {
    setForgotError('')
    if (!forgotEmail.trim()) {
      setForgotError(t('login.forgot_error_empty'))
      return
    }
    setForgotLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      })
      if (res.ok) setForgotDone(true)
      else {
        const d = await res.json()
        setForgotError(d.message || t('login.forgot_error'))
      }
    } catch {
      setForgotError(t('login.forgot_error_network'))
    } finally {
      setForgotLoading(false)
    }
  }

  const resetAccountChoices = () => {
    setAccountChoices(null)
    setPendingCredentials(null)
  }

  const openForgotModal = () => {
    setForgotOpen(true)
    setForgotDone(false)
    setForgotError('')
    setForgotEmail(email)
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPwd,
    setShowPwd,
    loading,
    alert,
    setAlert,
    suspended,
    setSuspended,
    emailRef,
    accountChoices,
    resetAccountChoices,
    submitCredentials,
    submitAccountChoice,
    forgotOpen,
    setForgotOpen,
    forgotEmail,
    setForgotEmail,
    forgotLoading,
    forgotDone,
    forgotError,
    openForgotModal,
    handleForgotSubmit,
  }
}
