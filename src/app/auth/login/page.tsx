import { notFound } from "next/navigation"
import LoginForm from "@/client/components/auth/login-form"
import { USERS_ENABLED } from "@/lib/feature-flags"

export default function LoginPage() {
  if (!USERS_ENABLED) notFound()
  return <LoginForm />
}
