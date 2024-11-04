// Create this new file in the root of your project
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Only apply to /api/extract-recipe route
  if (request.nextUrl.pathname === '/api/extract-recipe') {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large' },
        { status: 413 }
      )
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/extract-recipe'
}