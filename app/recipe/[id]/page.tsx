'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from "@/components/ui/use-toast"
import Image from 'next/image'
import { Heart, HeartOff } from 'lucide-react'
import { nanoid } from 'nanoid'

interface Recipe {
  id: number
  title: string
  image_url: string
  image_source_url: string
  description: string
  ingredients: string[]
  steps: string[]
  is_favorite: boolean
}

const RecipeDetailPage = ({ params }: { params: { id: string } }) => {
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [isFavoriting, setIsFavoriting] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRecipe() {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error) throw error
        console.log('Image URL:', data.image_url)
        setRecipe(data)
      } catch (error) {
        console.error('Error fetching recipe:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecipe()
  }, [params.id])

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this recipe?')) {
      return
    }

    setIsDeleting(true)

    try {
      if (recipe?.image_url) {
        const imagePath = recipe.image_url.split('/').pop()
        if (imagePath) {
          const { error: storageError } = await supabase.storage
            .from('recipes')
            .remove([imagePath])

          if (storageError) {
            console.error('Error deleting image:', storageError)
          }
        }
      }

      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', params.id)

      if (error) throw error

      toast({
        title: "Success",
        description: "Recipe deleted successfully",
      })

      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error deleting recipe:', error)
      toast({
        title: "Error",
        description: "Failed to delete recipe. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleFavorite = async () => {
    if (!recipe) return
    setIsFavoriting(true)
    
    try {
      const newFavoriteStatus = !recipe.is_favorite
      const { error } = await supabase
        .from('recipes')
        .update({ is_favorite: newFavoriteStatus })
        .eq('id', params.id)

      if (error) throw error

      setRecipe({ ...recipe, is_favorite: newFavoriteStatus })
      toast({
        title: newFavoriteStatus ? "Added to favorites" : "Removed from favorites",
      })
    } catch (error) {
      console.error('Error updating favorite status:', error)
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      })
    } finally {
      setIsFavoriting(false)
    }
  }

  const handleShare = async () => {
    try {
      // First get the current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to share recipes",
          variant: "destructive",
        })
        return
      }

      // Check for existing share, including expired ones
      const { data: existingShare } = await supabase
        .from('shared_recipes')
        .select('share_hash, expires_at')
        .eq('recipe_id', params.id)
        .eq('created_by', user.id)
        .single()

      let shareHash: string
      const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

      // If share exists and is not expired, use it
      if (existingShare && new Date(existingShare.expires_at) > new Date()) {
        shareHash = existingShare.share_hash
      } 
      // If share exists but is expired, update it
      else if (existingShare) {
        const { error } = await supabase
          .from('shared_recipes')
          .update({
            expires_at: expirationDate.toISOString(),
            share_hash: nanoid(10), // Generate new hash for security
          })
          .eq('share_hash', existingShare.share_hash)
          .select('share_hash')
          .single()

        if (error) throw error
        shareHash = existingShare.share_hash
      } 
      // If no share exists, create new one
      else {
        shareHash = nanoid(10)
        const { error } = await supabase
          .from('shared_recipes')
          .insert({
            recipe_id: params.id,
            share_hash: shareHash,
            created_by: user.id,
            expires_at: expirationDate.toISOString(),
          })

        if (error) throw error
      }

      const url = `${window.location.origin}/share/${shareHash}`
      setShareUrl(url)
      await navigator.clipboard.writeText(url)
      
      toast({
        title: "Link copied!",
        description: "Share link valid for 30 days has been copied to clipboard",
      })
    } catch (error) {
      console.error('Error creating share link:', error)
      toast({
        title: "Error",
        description: "Failed to create share link",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!recipe) {
    return <div>Recipe not found</div>
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{recipe.title}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFavorite}
          disabled={isFavoriting}
          className="hover:bg-transparent"
        >
          {recipe.is_favorite ? (
            <Heart className="h-6 w-6 fill-red-500 text-red-500" />
          ) : (
            <HeartOff className="h-6 w-6" />
          )}
        </Button>
      </div>
      <div className="relative">
        <Image
          src={recipe.image_url || '/default_image.png'}
          alt={recipe.title}
          width={800}
          height={400}
          className="w-full max-w-2xl mx-auto mb-6 rounded-lg object-cover h-[400px] cursor-pointer"
          onClick={() => setIsImageModalOpen(true)}
        />
        {recipe.image_source_url && (
          <div className="mt-2 text-center">
            <a 
              href={recipe.image_source_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 underline"
            >
              View Original Recipe
            </a>
          </div>
        )}
      </div>

      {isImageModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div className="max-w-[90vw] max-h-[90vh]">
            <Image
              src={recipe.image_url || '/default_image.png'}
              alt={recipe.title}
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <p className="text-xl mb-6">{recipe.description}</p>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Ingredients</h2>
          <ul className="list-disc pl-5 space-y-2">
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>{ingredient}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Steps</h2>
          <ol className="list-decimal pl-5 space-y-2">
            {recipe.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <Link href="/" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full">Back to Recipes</Button>
        </Link>
        <Link href={`/recipe/${params.id}/edit`} className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full">Edit Recipe</Button>
        </Link>
        <Button 
          variant="destructive" 
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-full sm:w-auto"
        >
          {isDeleting ? 'Deleting...' : 'Delete Recipe'}
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleShare}
          className="w-full sm:w-auto"
        >
          Share Recipe
        </Button>
      </div>
    </div>
  )
}

export default RecipeDetailPage