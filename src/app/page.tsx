"use client"

import dynamic from "next/dynamic"

const Dashboard = dynamic(() => import("@/client/components/dashboard/main-dashboard").then(m => ({ default: m.Dashboard })), { ssr: false })

export default function Home() {
  return <Dashboard />
}
