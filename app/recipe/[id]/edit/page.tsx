'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabase } from '@/utils/supabase'
import { useToast } from "@/components/ui/use-toast"
import Image from 'next/image'

const EditRecipePage = ({ params }: { params: { id: string } }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    async function fetchRecipe() {
      try {
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('id', params.id)
          .single()

        if (error) throw error

        setTitle(data.title)
        setDescription(data.description)
        setIngredients(data.ingredients.join('\n'))
        setSteps(data.steps.join('\n'))
        if (data.image_url) {
          setImagePreview(data.image_url)
        }
      } catch (error) {
        console.error('Error fetching recipe:', error)
        toast({
          title: "Error",
          description: "Failed to load recipe",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchRecipe()
  }, [params.id, toast])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`

    const { error: uploadError, data } = await supabase.storage
      .from('recipes')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('recipes')
      .getPublicUrl(fileName)

    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      let imageUrl = imagePreview
      if (image) {
        imageUrl = await uploadImage(image)
      }

      const ingredientsArray = ingredients
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0)

      const stepsArray = steps
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0)

      const { error } = await supabase
        .from('recipes')
        .update({
          title,
          description,
          ingredients: ingredientsArray,
          steps: stepsArray,
          image_url: imageUrl
        })
        .eq('id', params.id)

      if (error) throw error

      toast({
        title: "Success!",
        description: "Recipe updated successfully",
      })

      router.push(`/recipe/${params.id}`)
      router.refresh()
    } catch (error) {
      console.error('Error updating recipe:', error)
      toast({
        title: "Error",
        description: "Failed to update recipe",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Edit Recipe</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="image">Recipe Image</Label>
          <div className="mt-2 space-y-2">
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={isSubmitting}
            />
            {imagePreview && (
              <div className="relative w-full h-48">
                <Image
                  src={imagePreview}
                  alt="Recipe preview"
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="ingredients">Ingredients (one per line)</Label>
          <Textarea
            id="ingredients"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div>
          <Label htmlFor="steps">Steps (one per line)</Label>
          <Textarea
            id="steps"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="flex gap-4">
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push(`/recipe/${params.id}`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

export default EditRecipePage 