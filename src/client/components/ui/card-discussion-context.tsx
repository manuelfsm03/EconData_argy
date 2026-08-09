"use client"

import { createContext, useContext, type ReactNode } from "react"

interface CardDiscussionContextValue {
  title: string
  open: () => void
}

const CardDiscussionContext = createContext<CardDiscussionContextValue | null>(null)

export function CardDiscussionProvider({ title, open, children }: CardDiscussionContextValue & { children: ReactNode }) {
  return <CardDiscussionContext.Provider value={{ title, open }}>{children}</CardDiscussionContext.Provider>
}

export function useCardDiscussion() {
  return useContext(CardDiscussionContext)
}
