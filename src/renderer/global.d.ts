// Global type definitions for Electron APIs exposed via preload

interface ChatarooAPI {
  // Auth methods
  login: () => Promise<{ success: boolean; userInfo?: any; error?: string }>
  logout: () => Promise<{ success: boolean; error?: string }>
  getAuthStatus: () => Promise<{ isAuthenticated: boolean; userInfo: any | null; accessToken: string | null }>

  // Chat methods
  sendMessage: (options: {
    content: string
    broadcasterUserId: number
    replyToMessageId?: string
    type?: 'user' | 'bot'
  }) => Promise<{
    success: boolean
    data?: { success: boolean; messageId?: string; message: string }
    error?: string
  }>
}

declare global {
  interface Window {
    chatarooAPI: ChatarooAPI
  }
}

export {}
