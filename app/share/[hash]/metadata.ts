import { Metadata } from 'next'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function generateMetadata({ params }: { params: { hash: string } }): Promise<Metadata> {
  const supabase = createServerComponentClient({ cookies })
  
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

  return {
    title: recipe?.title,
    description: recipe?.description,
    openGraph: {
      title: recipe?.title,
      description: recipe?.description,
      images: [recipe?.image_url],
    },
  }
} 