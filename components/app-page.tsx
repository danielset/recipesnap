'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import RecipeCard from '@/components/RecipeCard'
import { Button } from '@/components/ui/button'
import { supabase } from '@/utils/supabase'
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { Session } from '@supabase/supabase-js'
import { PlusCircle } from 'lucide-react'

interface Recipe {
  id: number
  title: string
  description: string
  image_url: string
  created_at: string
  user_id: string
  ingredients?: string[]
  steps?: string[]
  meal_type?: string
  cuisine?: string
  is_favorite?: boolean
}

export function Page() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const { toast } = useToast()
  const [selectedMealType, setSelectedMealType] = useState<string>('')
  const [selectedCuisine, setCuisine] = useState<string>('')
  const [uniqueMealTypes, setUniqueMealTypes] = useState<string[]>([])
  const [uniqueCuisines, setUniqueCuisines] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const fetchRecipes = useCallback(async (search?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
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
          if (selectedMealType && recipe.meal_type !== selectedMealType) return false
          if (selectedCuisine && recipe.cuisine !== selectedCuisine) return false
          if (showFavoritesOnly && !recipe.is_favorite) return false

          const ingredientsMatch = recipe.ingredients?.some((ingredient: string) =>
            ingredient.toLowerCase().includes(searchLower)
          ) || false

          const stepsMatch = recipe.steps?.some((step: string) =>
            step.toLowerCase().includes(searchLower)
          ) || false

          const titleMatch = recipe.title.toLowerCase().includes(searchLower)
          const descriptionMatch = recipe.description?.toLowerCase().includes(searchLower)
          const mealTypeMatch = recipe.meal_type?.toLowerCase().includes(searchLower) || false
          const cuisineMatch = recipe.cuisine?.toLowerCase().includes(searchLower) || false

          return titleMatch || descriptionMatch || ingredientsMatch || stepsMatch || 
                 mealTypeMatch || cuisineMatch
        })

        setRecipes(filteredData)
      } else {
        const filteredQuery = query

        const { data, error } = await filteredQuery
        if (error) throw error

        let filteredData = data || []
        if (selectedMealType) {
          filteredData = filteredData.filter(recipe => recipe.meal_type === selectedMealType)
        }
        if (selectedCuisine) {
          filteredData = filteredData.filter(recipe => recipe.cuisine === selectedCuisine)
        }
        if (showFavoritesOnly) {
          filteredData = filteredData.filter(recipe => recipe.is_favorite)
        }

        setRecipes(filteredData)
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
  }, [toast, selectedMealType, selectedCuisine, showFavoritesOnly])

  const updateFilterOptions = (recipes: Recipe[]) => {
    const mealTypes = new Set(recipes.map(recipe => recipe.meal_type).filter((type): type is string => !!type))
    const cuisines = new Set(recipes.map(recipe => recipe.cuisine).filter((cuisine): cuisine is string => !!cuisine))
    
    setUniqueMealTypes(Array.from(mealTypes))
    setUniqueCuisines(Array.from(cuisines))
  }

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchRecipes(searchQuery)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery, selectedMealType, selectedCuisine, fetchRecipes])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    updateFilterOptions(recipes)
  }, [recipes])

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
        <>
          <div className="mb-6 flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <Input
              type="search"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full lg:w-80 h-10"
            />

            {/* Filters Group */}
            <div className="flex flex-row gap-4 items-center overflow-x-auto">
              <select
                value={selectedMealType}
                onChange={(e) => setSelectedMealType(e.target.value)}
                className="h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">All Meal Types</option>
                {uniqueMealTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                value={selectedCuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="h-10 w-[200px] rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="">All Cuisines</option>
                {uniqueCuisines.map((cuisine) => (
                  <option key={cuisine} value={cuisine}>
                    {cuisine}
                </option>
                ))}
              </select>

              <Button
                variant={showFavoritesOnly ? "default" : "outline"}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className="whitespace-nowrap h-10"
              >
                {showFavoritesOnly ? "★ Favorites Only" : "☆ Show All"}
              </Button>
            </div>

            {/* Add Recipe Button */}
            <Link href="/add-recipe" className="lg:ml-auto">
              <Button 
                className="w-full lg:w-auto h-10 bg-[#3397F2] hover:bg-[#3397F2]/90"
              >
                <PlusCircle className="mr-2 h-5 w-5" />
                Add New Recipe
              </Button>
            </Link>
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
                  {...recipe}
                  image={recipe.image_url || '/default_image.png'}
                  is_favorite={recipe.is_favorite ?? false}
                  onFavoriteChange={(id, newStatus) => {
                    setRecipes(recipes.map(r => 
                      r.id === id ? { ...r, is_favorite: newStatus } : r
                    ))
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Page