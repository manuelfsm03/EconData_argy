import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/server/auth/supabase-server"

export async function POST() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  return NextResponse.json({ data: { ok: true } })
}
