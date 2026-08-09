"use client"

import dynamic from "next/dynamic"

const AppShell = dynamic(() => import("@/client/components/workspace/app-shell").then(m => ({ default: m.AppShell })), { ssr: false })

export default function Home() {
  return <AppShell />
}
