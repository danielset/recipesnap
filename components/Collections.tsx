'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { PlusCircle, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/utils/supabase'

interface Collection {
  id: string
  name: string
  image_url?: string
  recipe_count?: number
}

// Add selectedCollection to props
interface CollectionsProps {
  selectedCollection: string | null;
  onCollectionSelect: (collectionId: string | null) => void;
  showFavoritesOnly: boolean;
  onFavoritesToggle: () => void;
}

export function Collections({ 
  selectedCollection, 
  onCollectionSelect, 
  showFavoritesOnly, 
  onFavoritesToggle 
}: CollectionsProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null)
  const { toast } = useToast()

  const fetchCollections = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('collections')
      .select(`
        id,
        name,
        created_at,
        collection_recipes!left (
          recipe:recipes (
            image_url
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching collections:', error)
      return
    }

    // Transform the data to get the first recipe's image for each collection
    const collectionsWithImage: Collection[] = data.map((collection: any) => ({
      ...collection,
      image_url: collection.collection_recipes?.[0]?.recipe?.image_url || null
    }))

    setCollections(collectionsWithImage)
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('collections')
        .insert([{
          name: newCollectionName,
          user_id: user.id
        }])

      if (error) throw error

      toast({
        title: "Success",
        description: "Collection created successfully",
      })

      setShowCreateDialog(false)
      setNewCollectionName('')
      fetchCollections()
    } catch (error) {
      console.error('Error creating collection:', error)
      toast({
        title: "Error",
        description: "Failed to create collection",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCollection = async () => {
    if (!collectionToDelete) return

    setLoading(true)
    try {
      // Delete the collection (cascade will handle collection_recipes)
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionToDelete.id)

      if (error) throw error

      // Update local state
      setCollections(collections.filter(c => c.id !== collectionToDelete.id))
      if (selectedCollection === collectionToDelete.id) {
        onCollectionSelect(null)
      }

      toast({
        title: "Collection deleted",
        description: `"${collectionToDelete.name}" has been deleted`,
      })
    } catch (error) {
      console.error('Error deleting collection:', error)
      toast({
        title: "Error",
        description: "Failed to delete collection. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setShowDeleteDialog(false)
      setCollectionToDelete(null)
    }
  }

  useEffect(() => {
    fetchCollections()
  }, [])

  return (
    <div className="mb-2">
      <div className="flex overflow-x-auto gap-4 py-4 px-2 no-scrollbar">
        {/* Create Collection Button */}
        <div className="flex flex-col items-center min-w-[80px]">
          <Button
            variant="outline"
            className="w-[80px] h-[80px] rounded-full p-0 border-2"
            onClick={() => setShowCreateDialog(true)}
          >
            <PlusCircle className="h-8 w-8" />
          </Button>
          <span className="text-sm mt-2 text-center">New Collection</span>
        </div>

        {/* Favorites Filter Button */}
        <div className="flex flex-col items-center min-w-[80px]">
          <Button
            variant="outline"
            className={`w-[80px] h-[80px] rounded-full p-0 border-2 ${
              showFavoritesOnly ? 'border-[#3397F2]' : 'border-primary'
            }`}
            onClick={onFavoritesToggle}
          >
            <Heart className={`h-8 w-8 ${showFavoritesOnly ? 'fill-current' : ''}`} />
          </Button>
          <span className="text-sm mt-2 text-center">Favorites</span>
        </div>

        {/* Collection Stories */}
        {collections.map((collection) => (
          <div 
            key={collection.id} 
            className="flex flex-col items-center min-w-[80px]"
          >
            <div 
              className={`w-[80px] h-[80px] rounded-full overflow-hidden border-2 transition-colors ${
                selectedCollection === collection.id 
                  ? 'border-[#3397F2]' 
                  : 'border-primary'
              }`}
              onClick={() => onCollectionSelect(
                selectedCollection === collection.id ? null : collection.id
              )}
            >
              {collection.image_url ? (
                <Image
                  src={collection.image_url}
                  alt={collection.name}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  {collection.name[0].toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-sm mt-2 text-center truncate w-20">
              {collection.name}
            </span>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete &quot;{collectionToDelete?.name}&quot;? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCollection}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Collection Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Collection Name</Label>
              <Input
                id="name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="My Collection"
              />
            </div>
            <Button
              onClick={handleCreateCollection}
              disabled={loading || !newCollectionName.trim()}
              className="w-full"
            >
              {loading ? 'Creating...' : 'Create Collection'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 