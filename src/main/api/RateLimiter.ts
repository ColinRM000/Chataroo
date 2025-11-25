interface QueueItem<T> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason: any) => void
}

export class RateLimiter {
  private maxRequests: number
  private queue: QueueItem<any>[] = []
  private processing = false
  private lastRequestTime = 0
  private minInterval: number

  constructor(maxRequestsPerSecond: number = 1) {
    this.maxRequests = maxRequestsPerSecond
    this.minInterval = 1000 / maxRequestsPerSecond // milliseconds between requests
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject })
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime

      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, this.minInterval - timeSinceLastRequest)
        )
      }

      const item = this.queue.shift()
      if (!item) break

      this.lastRequestTime = Date.now()

      try {
        const result = await item.fn()
        item.resolve(result)
      } catch (error: any) {
        if (error.response && error.response.status === 429) {
          const retryAfter = error.response.headers['retry-after']
          const backoffTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000

          await new Promise(resolve => setTimeout(resolve, backoffTime))
          this.queue.unshift(item)
        } else {
          item.reject(error)
        }
      }
    }

    this.processing = false
  }
}
