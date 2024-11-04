'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Recipe } from '@/types/recipe'
import { nanoid } from 'nanoid'

const SharedRecipePage = ({ params }: { params: { hash: string } }) => {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const [isOwner, setIsOwner] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    async function fetchSharedRecipe() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        const { data: sharedData, error: sharedError } = await supabase
          .from('shared_recipes')
          .select('recipe_id, created_by, expires_at')
          .eq('share_hash', params.hash)
          .single()

        if (sharedError) throw sharedError

        // Check if link is expired
        const isLinkExpired = new Date(sharedData.expires_at) < new Date()
        setIsExpired(isLinkExpired)
        
        // Check if current user is the creator
        const isCreator = user?.id === sharedData.created_by
        setIsOwner(isCreator)

        if (isLinkExpired && !isCreator) {
          setError('This share link has expired')
          return
        }

        const { data: recipeData, error: recipeError } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', sharedData.recipe_id)
          .single()

        if (recipeError) throw recipeError
        setRecipe(recipeData)
      } catch (error) {
        console.error('Error fetching shared recipe:', error)
        setError('Failed to load recipe')
      } finally {
        setLoading(false)
      }
    }

    fetchSharedRecipe()
  }, [params.hash])

  const handleRegenerateLink = async () => {
    if (!recipe || !isOwner) return

    try {
      const newHash = nanoid(10)
      const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      const { error } = await supabase
        .from('shared_recipes')
        .update({
          share_hash: newHash,
          expires_at: expirationDate.toISOString(),
        })
        .eq('share_hash', params.hash)

      if (error) throw error

      const newUrl = `${window.location.origin}/share/${newHash}`
      await navigator.clipboard.writeText(newUrl)
      
      toast({
        title: "New link generated!",
        description: "New share link has been copied to clipboard",
      })

      // Redirect to new URL
      router.push(newUrl)
    } catch (error) {
      console.error('Error regenerating link:', error)
      toast({
        title: "Error",
        description: "Failed to regenerate share link",
        variant: "destructive",
      })
    }
  }

  const handleImport = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast({
          title: "Error",
          description: "Please login to import recipes",
          variant: "destructive",
        })
        return
      }

      const { data: existingRecipe } = await supabase
        .from('recipes')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', recipe?.title)
        .single()

      if (existingRecipe) {
        toast({
          title: "Warning",
          description: "You already have this recipe in your collection",
          variant: "destructive",
        })
        return
      }

      const { error: insertError } = await supabase
        .from('recipes')
        .insert([{
          title: recipe?.title,
          description: recipe?.description,
          image_url: recipe?.image_url,
          ingredients: recipe?.ingredients,
          steps: recipe?.steps,
          user_id: user.id,
          image_source_url: recipe?.image_source_url,
          meal_type: recipe?.meal_type,
          cuisine: recipe?.cuisine,
          is_favorite: false
        }])
      
      if (insertError) throw insertError
      
      toast({
        title: "Success",
        description: "Recipe imported successfully",
      })
      router.push('/')
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: "Error",
        description: "Failed to import recipe",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (isExpired && isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h2 className="text-xl font-semibold mb-4">This share link has expired</h2>
        <Button onClick={handleRegenerateLink}>
          Generate New Share Link
        </Button>
      </div>
    )
  }

  if (error || !recipe) {
    return <div className="flex justify-center items-center min-h-screen">{error || 'Failed to load recipe'}</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{recipe.title}</h1>
      
      <div className="md:flex md:gap-8 mb-4">
        {recipe.image_url && (
          <div className="relative w-full md:w-1/2 h-96 mb-4 md:mb-0">
            <Image
              src={recipe.image_url}
              alt={recipe.title}
              fill
              className="object-cover rounded-lg"
            />
          </div>
        )}
        
        <div className="md:w-1/2">
          <h2 className="text-xl font-semibold mb-2">Ingredients</h2>
          <ul className="list-disc pl-5">
            {recipe.ingredients.map((ingredient: string, index: number) => (
              <li key={index}>{ingredient}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Description</h2>
        <p>{recipe.description}</p>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Instructions</h2>
        <ol className="list-decimal pl-5">
          {recipe.steps.map((step: string, index: number) => (
            <li key={index} className="mb-2">{step}</li>
          ))}
        </ol>
      </div>

      <Button onClick={handleImport}>Import Recipe</Button>
    </div>
  )
}

export default SharedRecipePage 