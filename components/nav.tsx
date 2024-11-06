// components/nav.tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/utils/supabase'
import { useToast } from '@/components/ui/use-toast'
import Image from 'next/image'

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
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="text-xl font-bold">
            <Image 
              src="/logo_recipinny.svg" 
              alt="Recipinny" 
              width={32}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                
                <Button 
                  variant="ghost" 
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Link href="/auth/sign-in">
                <Button>Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}