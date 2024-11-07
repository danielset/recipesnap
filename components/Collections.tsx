'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { PlusCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/utils/supabase'

interface Collection {
  id: string
  name: string
  image_url: string
  recipe_count?: number
}

// Add selectedCollection to props
interface CollectionsProps {
  selectedCollection: string | null;
  onCollectionSelect: (collectionId: string | null) => void;
}

export function Collections({ selectedCollection, onCollectionSelect }: CollectionsProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionImage, setNewCollectionImage] = useState<File | null>(null)
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
        *,
        collection_recipes (
          count
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching collections:', error)
      return
    }

    // Transform the data to include recipe_count
    const collectionsWithCount = data.map(collection => ({
      ...collection,
      recipe_count: collection.collection_recipes?.[0]?.count || 0
    }))

    setCollections(collectionsWithCount)
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let imageUrl = null
      if (newCollectionImage) {
        const fileExt = newCollectionImage.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('collections')
          .upload(fileName, newCollectionImage)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('collections')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
      }

      const { error } = await supabase
        .from('collections')
        .insert([{
          name: newCollectionName,
          image_url: imageUrl,
          user_id: user.id
        }])

      if (error) throw error

      toast({
        title: "Success",
        description: "Collection created successfully",
      })

      setShowCreateDialog(false)
      setNewCollectionName('')
      setNewCollectionImage(null)
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

        {/* Collection Stories */}
        {collections.map((collection) => (
          <div 
            key={collection.id} 
            className="flex flex-col items-center min-w-[80px] group relative"
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
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  {collection.name[0].toUpperCase()}
                </div>
              )}
            </div>
            {/* Delete Button - appears on hover */}
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-1 -right-1 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation()
                setCollectionToDelete(collection)
                setShowDeleteDialog(true)
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
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
            <div className="space-y-2">
              <Label htmlFor="image">Collection Image</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={(e) => setNewCollectionImage(e.target.files?.[0] || null)}
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