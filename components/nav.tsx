// components/nav.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/components/ui/use-toast'
import Image from 'next/image'
import { LogIn, LogOut } from 'lucide-react'

export function Nav() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out.",
        variant: "destructive",
      })
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-[#3397F2] shadow">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16 items-center relative">
          <Link href="/" className="absolute left-1/2 -translate-x-1/2 sm:static sm:translate-x-0">
            <Image 
              src="/logo_recipinny.svg" 
              alt="Recipinny" 
              width={20}
              height={20}
              className="h-5 w-auto"
            />
          </Link>
          <div className="ml-auto">
            {user ? (
              <Button 
                variant="ghost" 
                onClick={handleSignOut}
                className="text-white hover:bg-transparent"
                size="icon"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            ) : (
              <Link href="/auth/sign-in">
                <Button 
                  variant="ghost"
                  className="text-white hover:bg-transparent"
                  size="icon"
                >
                  <LogIn className="h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}