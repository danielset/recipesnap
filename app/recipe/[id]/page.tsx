'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from "@/components/ui/use-toast"
import Image from 'next/image'

interface Recipe {
  id: number
  title: string
  image_url: string
  image_source_url: string
  description: string
  ingredients: string[]
  steps: string[]
}

const RecipeDetailPage = ({ params }: { params: { id: string } }) => {
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

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

  if (loading) {
    return <div>Loading...</div>
  }

  if (!recipe) {
    return <div>Recipe not found</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">{recipe.title}</h1>
      <div className="relative">
        <Image
          src={recipe.image_url || '/placeholder.svg?height=400&width=600'}
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
              src={recipe.image_url || '/placeholder.svg?height=400&width=600'}
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
      </div>
    </div>
  )
}

export default RecipeDetailPage