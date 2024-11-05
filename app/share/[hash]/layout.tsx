import { Metadata } from 'next'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function generateMetadata({ params }: { params: { hash: string } }): Promise<Metadata> {
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
      .select('title, description, image_url, cuisine, meal_type')
      .eq('id', sharedData.recipe_id)
      .single()

    if (!recipe) {
      return {
        title: 'Recipe Not Found',
        description: 'The requested recipe could not be found'
      }
    }

    const title = recipe.title || 'Shared Recipe'
    const description = recipe.description || 'A shared recipe from RecipeSnap'
    const url = `https://recipesnap.vercel.app/share/${params.hash}`

    return {
      metadataBase: new URL('https://recipesnap.vercel.app'),
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        images: recipe.image_url ? [
          {
            url: recipe.image_url,
            width: 1200,
            height: 630,
            alt: title,
          }
        ] : [],
        type: 'article',
        siteName: 'RecipeSnap',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: recipe.image_url ? [recipe.image_url] : [],
      },
      alternates: {
        canonical: url,
      }
    }
  } catch (error) {
    console.error('Error generating metadata:', error)
    return {
      title: 'Recipe Error',
      description: 'There was an error loading this recipe'
    }
  }
}

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 