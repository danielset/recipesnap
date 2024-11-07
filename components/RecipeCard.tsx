import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Heart, Plus, Minus } from 'lucide-react'
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/utils/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"

interface Collection {
  id: string
  name: string
  image_url: string
}

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
  const [collections, setCollections] = useState<Collection[]>([])
  const [recipeCollections, setRecipeCollections] = useState<string[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

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

  const fetchCollections = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch all collections
    const { data: collectionsData } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', user.id)

    if (collectionsData) setCollections(collectionsData)

    // Fetch collections this recipe belongs to
    const { data: recipeCollectionsData } = await supabase
      .from('collection_recipes')
      .select('collection_id')
      .eq('recipe_id', id)

    if (recipeCollectionsData) {
      setRecipeCollections(recipeCollectionsData.map(rc => rc.collection_id))
    }
  }, [id])

  const handleAddToCollections = async () => {
    setLoading(true)
    try {
      // Remove recipe from unselected collections
      const collectionsToRemove = recipeCollections.filter(
        cId => !selectedCollections.includes(cId)
      )
      
      // Add recipe to newly selected collections
      const collectionsToAdd = selectedCollections.filter(
        cId => !recipeCollections.includes(cId)
      )

      const promises = [
        ...collectionsToAdd.map(collectionId =>
          supabase
            .from('collection_recipes')
            .insert({ collection_id: collectionId, recipe_id: id })
        ),
        ...collectionsToRemove.map(collectionId =>
          supabase
            .from('collection_recipes')
            .delete()
            .eq('collection_id', collectionId)
            .eq('recipe_id', id)
        )
      ]

      await Promise.all(promises)

      setRecipeCollections(selectedCollections)
      setShowAddDialog(false)
      toast({
        title: "Success",
        description: "Collections updated successfully",
      })
    } catch (error) {
      console.error('Error updating collections:', error)
      toast({
        title: "Error",
        description: "Failed to update collections",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFromCollection = async (collectionId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('collection_recipes')
        .delete()
        .eq('collection_id', collectionId)
        .eq('recipe_id', id)

      if (error) throw error

      setRecipeCollections(prev => prev.filter(cId => cId !== collectionId))
      setShowRemoveDialog(false)
      toast({
        title: "Success",
        description: "Recipe removed from collection",
      })
    } catch (error) {
      console.error('Error removing from collection:', error)
      toast({
        title: "Error",
        description: "Failed to remove from collection",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCollections()
  }, [id, fetchCollections])

  useEffect(() => {
    setSelectedCollections(recipeCollections)
  }, [recipeCollections])

  return (
    <Link href={`/recipe/${id}`}>
      <div className="group relative h-full rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg">
        <div className="absolute right-2 top-2 z-10 flex gap-2">
          {/* Collections Button */}
          <button
            onClick={(e) => {
              e.preventDefault()
              if (recipeCollections.length > 0) {
                setShowRemoveDialog(true)
              } else {
                setShowAddDialog(true)
              }
            }}
            className="rounded-full bg-white/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-white"
          >
            {recipeCollections.length > 0 ? (
              <Minus className="h-5 w-5 text-gray-600" />
            ) : (
              <Plus className="h-5 w-5 text-gray-600" />
            )}
          </button>

          {/* Existing Favorite Button */}
          <button
            onClick={toggleFavorite}
            className="rounded-full bg-white/80 p-1.5 backdrop-blur-sm transition-colors hover:bg-white"
            disabled={isFavoriting}
          >
            <Heart 
              className={`h-5 w-5 transition-colors ${
                is_favorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
              }`}
            />
          </button>
        </div>

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

        {/* Add to Collections Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Collections</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[300px] pr-4">
              {collections.map((collection) => (
                <div 
                  key={collection.id} 
                  className="flex items-center space-x-2 py-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    id={collection.id}
                    checked={selectedCollections.includes(collection.id)}
                    onCheckedChange={(checked) => {
                      setSelectedCollections(prev =>
                        checked
                          ? [...prev, collection.id]
                          : prev.filter(id => id !== collection.id)
                      )
                    }}
                  />
                  <label 
                    htmlFor={collection.id} 
                    className="text-sm font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {collection.name}
                  </label>
                </div>
              ))}
            </ScrollArea>
            <Button
              onClick={(e) => {
                e.preventDefault()
                handleAddToCollections()
              }}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Updating...' : 'Update Collections'}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Remove from Collections Dialog */}
        <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove from Collection</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[300px]">
              {collections
                .filter(collection => recipeCollections.includes(collection.id))
                .map((collection) => (
                  <Button
                    key={collection.id}
                    variant="outline"
                    className="w-full mb-2"
                    onClick={(e) => {
                      e.preventDefault()
                      handleRemoveFromCollection(collection.id)
                    }}
                    disabled={loading}
                  >
                    Remove from &quot;{collection.name}&quot;
                  </Button>
                ))
              }
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </Link>
  )
}

export default RecipeCard