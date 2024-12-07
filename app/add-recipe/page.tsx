'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { supabase } from '@/utils/supabase'
import { useToast } from "@/components/ui/use-toast"
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import imageCompression from 'browser-image-compression';

const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  e.target.style.height = 'auto'
  e.target.style.height = `${e.target.scrollHeight}px`
}

async function compressImage(file: File) {
  const options = {
    maxSizeMB: 4,          // Max file size of 1MB
    maxWidthOrHeight: 1920, // Maintain good quality for recipe images
    useWebWorker: true
  };
  
  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}

const AddRecipePage = () => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [showUrlDialog, setShowUrlDialog] = useState(false)
  const [extractedImageUrl, setExtractedImageUrl] = useState<string | null>(null)
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [extractImage, setExtractImage] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [imageSourceUrl, setImageSourceUrl] = useState<string | null>(null)
  const [mealType, setMealType] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [showInstagramDialog, setShowInstagramDialog] = useState(false)
  const [instagramUrl, setInstagramUrl] = useState('')
  const router = useRouter()
  const { toast } = useToast()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      // Create a preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (file: File) => {
    try {
      // Check buckets first
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
      console.log('Available buckets:', buckets)
  
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError)
        throw bucketsError
      }
  
      if (!buckets?.some(b => b.name === 'recipes')) {
        throw new Error('Recipes bucket not found! Please create it in Supabase dashboard.')
      }
  
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
  
      const { error: uploadError, data } = await supabase.storage
        .from('recipes')
        .upload(fileName, file)
  
      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw uploadError
      }
  
      console.log('Upload successful:', data)
  
      const { data: { publicUrl } } = supabase.storage
        .from('recipes')
        .getPublicUrl(fileName)
  
      console.log('Generated URL:', publicUrl)
  
      return publicUrl
    } catch (error) {
      console.error('Error in uploadImage:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // First, get the current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to add recipes.",
          variant: "destructive",
        })
        return
      }

      // Modify this section to use either uploaded image or extracted URL
      let imageUrl = null
      if (image) {
        imageUrl = await uploadImage(image)
      } else if (extractedImageUrl) {
        imageUrl = extractedImageUrl
      }

      const ingredientsArray = ingredients
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0)

      const stepsArray = steps
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0)

      const { data, error } = await supabase
        .from('recipes')
        .insert([
          {
            title,
            description,
            ingredients: ingredientsArray,
            steps: stepsArray,
            user_id: user.id,
            image_url: imageUrl,
            image_source_url: imageSourceUrl,
            meal_type: mealType,
            cuisine: cuisine
          }
        ])
        .select()
        .single()

      if (error) throw error

      toast({
        title: "Success!",
        description: "Your recipe has been added.",
      })

      router.push(`/recipe/${data.id}`)
      router.refresh()
    } catch (error) {
      console.error('Error adding recipe:', error)
      toast({
        title: "Error",
        description: "Failed to add recipe. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleExtractFromUrl = async () => {
    if (!urlInput) return
    
    setIsExtracting(true)
    try {
      const formData = new FormData();
      formData.append('url', urlInput);

      const response = await fetch('/api/extract-recipe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to extract recipe')

      const data = await response.json()

      setTitle(data.title || '')
      setDescription(data.description || '')
      setIngredients(data.ingredients?.join('\n') || '')
      setSteps(data.steps?.join('\n') || '')
      setMealType(data.meal_type || '')
      setCuisine(data.cuisine || '')
      
      if (data.image_url) {
        setImagePreview(data.image_url)
        setExtractedImageUrl(data.image_url)
        setImageSourceUrl(urlInput)
      }

      setShowUrlDialog(false)
      toast({
        title: "Success!",
        description: "Recipe extracted successfully",
      })
    } catch (error) {
      console.error('Error extracting recipe:', error)
      toast({
        title: "Error",
        description: "Failed to extract recipe. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleExtractFromImage = async () => {
    if (!extractImage) return
    
    setIsExtracting(true)
    try {
      const formData = new FormData()
      formData.append('image', extractImage)

      const response = await fetch('/api/extract-recipe', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to extract recipe')
      }

      const data = await response.json()

      setTitle(data.title || '')
      setDescription(data.description || '')
      setIngredients(data.ingredients?.join('\n') || '')
      setSteps(data.steps?.join('\n') || '')
      setMealType(data.meal_type || '')
      setCuisine(data.cuisine || '')
      
      if (data.image_url) {
        setImagePreview(data.image_url)
        setExtractedImageUrl(data.image_url)
      }

      setShowImageDialog(false)
      toast({
        title: "Success!",
        description: "Recipe extracted successfully",
      })
    } catch (error) {
      console.error('Error extracting recipe:', error)
      toast({
        title: "Error",
        description: "Failed to extract recipe. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleExtractFromInstagram = async () => {
    if (!instagramUrl) return
    
    setIsExtracting(true)
    try {
      const formData = new FormData();
      formData.append('url', instagramUrl);
      formData.append('isInstagram', 'true');

      const response = await fetch('/api/extract-recipe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to extract recipe')

      const data = await response.json()

      setTitle(data.title || '')
      setDescription(data.description || '')
      setIngredients(data.ingredients?.join('\n') || '')
      setSteps(data.steps?.join('\n') || '')
      setMealType(data.meal_type || '')
      setCuisine(data.cuisine || '')
      
      if (data.image_url) {
        setImagePreview(data.image_url)
        setExtractedImageUrl(data.image_url)
        setImageSourceUrl(instagramUrl)
      }

      setShowInstagramDialog(false)
      toast({
        title: "Success!",
        description: "Recipe extracted from Instagram post",
      })
    } catch (error) {
      console.error('Error extracting recipe:', error)
      toast({
        title: "Error",
        description: "Failed to extract recipe. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check initial file size
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB initial limit
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Large Image Detected",
        description: "Compressing image for upload...",
      });
    }

    try {
      let processedFile = file;
      
      // Handle HEIC first if needed
      if (file.type.toLowerCase().includes('heic')) {
        setIsConverting(true);
        // Your existing HEIC conversion logic
      }

      // Compress the image if it's not a HEIC file or after HEIC conversion
      if (processedFile.size > MAX_FILE_SIZE) {
        processedFile = await compressImage(processedFile);
      }

      setExtractImage(processedFile);
      setIsConverting(false);
    } catch (err) {
      console.error('Image processing error:', err);
      toast({
        title: "Error",
        description: "Failed to process image. Please try a different image.",
        variant: "destructive",
      });
      e.target.value = ''; // Reset the input
    }
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold">Add New Recipe</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowUrlDialog(true)}
            className="w-full sm:w-auto"
          >
            Extract from URL
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowImageDialog(true)}
            className="w-full sm:w-auto"
          >
            Extract from Image
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowInstagramDialog(true)}
            className="w-full sm:w-auto"
          >
            Extract from Instagram
          </Button>
        </div>
      </div>

      <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract Recipe from URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Enter recipe URL..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={isExtracting}
                className="w-full"
              />
              <Button 
                onClick={handleExtractFromUrl}
                disabled={!urlInput || isExtracting}
              >
                {isExtracting ? 'Extracting...' : 'Extract'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract Recipe from Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/*,.heic"
                onChange={handleImageSelect}
                disabled={isExtracting || isConverting}
              />
              <Button 
                onClick={handleExtractFromImage}
                disabled={!extractImage || isExtracting || isConverting}
                className="w-full"
              >
                {isExtracting ? 'Extracting...' : isConverting ? 'Converting...' : 'Extract'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInstagramDialog} onOpenChange={setShowInstagramDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extract Recipe from Instagram Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Enter Instagram post URL..."
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                disabled={isExtracting}
                className="w-full"
              />
              <Button 
                onClick={handleExtractFromInstagram}
                disabled={!instagramUrl || isExtracting}
              >
                {isExtracting ? 'Extracting...' : 'Extract'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={isSubmitting}
            className="w-full"
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
            onChange={(e) => {
              setDescription(e.target.value)
              autoResize(e)
            }}
            required
            disabled={isSubmitting}
            className="min-h-[100px] w-full"
          />
        </div>

        <div>
          <Label htmlFor="ingredients">Ingredients (one per line)</Label>
          <Textarea
            id="ingredients"
            value={ingredients}
            onChange={(e) => {
              setIngredients(e.target.value)
              autoResize(e)
            }}
            required
            disabled={isSubmitting}
            className="min-h-[150px] w-full"
          />
        </div>

        <div>
          <Label htmlFor="steps">Steps (one per line)</Label>
          <Textarea
            id="steps"
            value={steps}
            onChange={(e) => {
              setSteps(e.target.value)
              autoResize(e)
            }}
            required
            disabled={isSubmitting}
            className="min-h-[150px] w-full"
          />
        </div>

        <div>
          <Label htmlFor="meal-type">Meal Type</Label>
          <Input
            id="meal-type"
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            placeholder="e.g., Breakfast, Lunch, Dinner, Snack"
            disabled={isSubmitting}
            className="w-full"
          />
        </div>

        <div>
          <Label htmlFor="cuisine">Cuisine</Label>
          <Input
            id="cuisine"
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            placeholder="e.g., Italian, Mexican, Japanese"
            disabled={isSubmitting}
            className="w-full"
          />
        </div>

        <div className="flex gap-4">
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding Recipe...' : 'Add Recipe'}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push('/')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

export default AddRecipePage