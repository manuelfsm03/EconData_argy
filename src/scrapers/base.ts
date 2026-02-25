import { chromium, Browser, Page } from "playwright"
import { prisma } from "@/lib/prisma"

export interface ScrapeResult {
  success: boolean
  recordsAdded: number
  message?: string
}

export abstract class BaseScraper {
  protected browser: Browser | null = null
  protected page: Page | null = null
  public readonly source: string

  constructor(source: string) {
    this.source = source
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
    })
    this.page = await this.browser.newPage()
    await this.page.setViewportSize({ width: 1920, height: 1080 })
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }

  async logStart(): Promise<string> {
    const log = await prisma.scrapeLog.create({
      data: {
        source: this.source,
        status: "running",
        startedAt: new Date(),
      },
    })
    return log.id
  }

  async logComplete(
    logId: string,
    result: ScrapeResult
  ): Promise<void> {
    await prisma.scrapeLog.update({
      where: { id: logId },
      data: {
        status: result.success ? "success" : "error",
        message: result.message,
        recordsAdded: result.recordsAdded,
        completedAt: new Date(),
        duration: Date.now() - (await prisma.scrapeLog.findUnique({ where: { id: logId } }))!.startedAt.getTime(),
      },
    })
  }

  abstract scrape(): Promise<ScrapeResult>

  async run(): Promise<ScrapeResult> {
    const logId = await this.logStart()

    try {
      await this.init()
      const result = await this.scrape()
      await this.logComplete(logId, result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      const result: ScrapeResult = {
        success: false,
        recordsAdded: 0,
        message: errorMessage,
      }
      await this.logComplete(logId, result)
      return result
    } finally {
      await this.close()
    }
  }
}
