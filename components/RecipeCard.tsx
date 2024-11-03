import Image from 'next/image'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { useState } from 'react'
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/utils/supabase'

interface RecipeCardProps {
  id: number
  title: string
  description: string
  image: string
  meal_type?: string
  cuisine?: string
  is_favorite: boolean
  onFavoriteChange?: (id: number, newStatus: boolean) => void
}

const RecipeCard = ({ 
  id, 
  title, 
  description, 
  image, 
  meal_type, 
  cuisine, 
  is_favorite,
  onFavoriteChange 
}: RecipeCardProps) => {
  const [isFavoriting, setIsFavoriting] = useState(false)
  const { toast } = useToast()

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (isFavoriting) return
    
    setIsFavoriting(true)
    try {
      const newFavoriteStatus = !is_favorite
      const { error } = await supabase
        .from('recipes')
        .update({ is_favorite: newFavoriteStatus })
        .eq('id', id)

      if (error) throw error

      onFavoriteChange?.(id, newFavoriteStatus)
      
      toast({
        title: newFavoriteStatus ? "Added to favorites" : "Removed from favorites",
        description: newFavoriteStatus 
          ? "Recipe has been added to your favorites"
          : "Recipe has been removed from your favorites",
      })
    } catch (error) {
      console.error('Error updating favorite status:', error)
      toast({
        title: "Error",
        description: "Failed to update favorite status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsFavoriting(false)
    }
  }

  return (
    <Link href={`/recipe/${id}`}>
      <div className="group relative h-full rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg">
        <button
          onClick={toggleFavorite}
          className="absolute right-2 top-2 z-10 rounded-full bg-white/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-white"
          disabled={isFavoriting}
        >
          <Heart 
            className={`h-5 w-5 transition-colors ${
              is_favorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
            }`}
          />
        </button>

        <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-all group-hover:scale-105"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {meal_type && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {meal_type}
            </span>
          )}
          {cuisine && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              {cuisine}
            </span>
          )}
        </div>

        <div className="p-4 pt-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">{description}</p>
        </div>
      </div>
    </Link>
  )
}

export default RecipeCard