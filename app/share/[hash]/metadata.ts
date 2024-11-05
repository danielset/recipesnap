import { Metadata } from 'next'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export default async function generateMetadata({ params }: { params: { hash: string } }): Promise<Metadata> {
  const supabase = createServerComponentClient({ cookies })
  
  try {
    const { data: sharedData } = await supabase
      .from('shared_recipes')
      .select('recipe_id')
      .eq('share_hash', params.hash)
      .single()

    if (!sharedData) {
      return {
        title: 'Recipe Not Found',
        description: 'The requested recipe could not be found'
      }
    }

    const { data: recipe } = await supabase
      .from('recipes')
      .select('title, description, image_url')
      .eq('id', sharedData.recipe_id)
      .single()

    if (!recipe) {
      return {
        title: 'Recipe Not Found',
        description: 'The requested recipe could not be found'
      }
    }

    return {
      title: recipe.title || 'Shared Recipe',
      description: recipe.description || 'A shared recipe from RecipeSnap',
      openGraph: {
        title: recipe.title || 'Shared Recipe',
        description: recipe.description || 'A shared recipe from RecipeSnap',
        images: recipe.image_url ? [recipe.image_url] : [],
      },
    }
  } catch {
    return {
      title: 'Recipe Error',
      description: 'There was an error loading this recipe'
    }
  }
} 