'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import RecipeCard from '@/components/RecipeCard'
import { Button } from '@/components/ui/button'
import { supabase } from '@/utils/supabase'
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Session } from '@supabase/supabase-js'

interface Recipe {
  id: number
  title: string
  description: string
  image_url: string
  created_at: string
  user_id: string
  ingredients?: string[]
  steps?: string[]
}

export function Page() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const { toast } = useToast()

  const fetchRecipes = async (search?: string) => {
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      
      // If no session, set empty recipes and return
      if (!session) {
        setRecipes([])
        return
      }

      const query = supabase
        .from('recipes')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (search) {
        const { data, error } = await query
        
        if (error) throw error
        if (!data) return setRecipes([])

        const searchLower = search.toLowerCase()
        const filteredData = data.filter(recipe => {
          // More precise search in ingredients
          const ingredientsMatch = recipe.ingredients?.some((ingredient: string) =>
            ingredient.toLowerCase().includes(searchLower)
          ) || false

          // More precise search in steps
          const stepsMatch = recipe.steps?.some((step: string) =>
            step.toLowerCase().includes(searchLower)
          ) || false

          // Match in title or description
          const titleMatch = recipe.title.toLowerCase().includes(searchLower)
          const descriptionMatch = recipe.description?.toLowerCase().includes(searchLower)

          return titleMatch || descriptionMatch || ingredientsMatch || stepsMatch
        })

        setRecipes(filteredData)
      } else {
        const { data, error } = await query
        if (error) throw error
        setRecipes(data || [])
      }
    } catch (error) {
      console.error('Error fetching recipes:', error)
      toast({
        title: "Error",
        description: "Failed to load recipes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchRecipes(searchQuery)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="container mx-auto p-4">
      {!session ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-600 mb-4">Please log in to view your recipes</p>
          <Link href="/auth/sign-in">
            <Button variant="outline">Log In</Button>
          </Link>
        </div>
      ) : (
        <div className="flex justify-between items-center mb-6">
          <Link href="/add-recipe">
            <Button>Add New Recipe</Button>
          </Link>
        </div>
      )}

      <div className="mb-6">
        <Input
          type="search"
          placeholder="Search recipes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl text-gray-600 mb-4">No recipes found</p>
          <Link href="/recipes/add">
            <Button variant="outline">Add Your First Recipe</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              title={recipe.title}
              description={recipe.description}
              image={recipe.image_url || '/placeholder.svg?height=200&width=300'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Page