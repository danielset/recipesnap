import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'
import heicConvert from 'heic-convert'
import FirecrawlApp from '@mendable/firecrawl-js'

export const maxDuration = 300 // 5 minutes
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// To handle large files, we need to use Edge Runtime configuration
export const generateStaticParams = async () => {
  return []
}

async function getOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    const html = await response.text()
    
    const match = html.match(/<meta[^>]*property="og:image(?::secure_url)?"[^>]*content="([^"]*)"[^>]*>|<meta[^>]*content="([^"]*)"[^>]*property="og:image(?::secure_url)?"[^>]*>/)
    
    if (match) {
      return match[1] || match[2] || null
    }
    
    return null
  } catch (error) {
    console.error('Error fetching og:image:', error)
    return null
  }
}

async function convertHeicToJpeg(file: File): Promise<File> {
  if (!file.type.includes('heic')) return file;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const jpegBuffer = await heicConvert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.9
    });

    return new File([jpegBuffer], file.name.replace('.heic', '.jpg'), {
      type: 'image/jpeg'
    });
  } catch (error) {
    console.error('Error converting HEIC:', error);
    throw new Error('Failed to convert HEIC image');
  }
}

// Add new function to scrape URL
async function scrapeRecipeUrl(url: string): Promise<string> {
  const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
  
  const scrapeResponse = await app.scrapeUrl(url, {
    formats: ['markdown']
  })

  if (!scrapeResponse.success || !scrapeResponse.markdown) {
    throw new Error(`Failed to scrape URL: ${scrapeResponse.error || 'No markdown content'}`)
  }

  return scrapeResponse.markdown
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const url = formData.get('url') as string | null
    let image = formData.get('image') as File | null

    // Convert HEIC to JPEG if necessary
    if (image && image.type.toLowerCase().includes('heic')) {
      image = await convertHeicToJpeg(image)
    }

    let completion;
    let imageUrl = null;

    if (url) {
      // First scrape the URL content
      const [markdown, ogImage] = await Promise.all([
        scrapeRecipeUrl(url),
        getOgImage(url)
      ])

      // Then pass the markdown to ChatGPT
      completion = await new OpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts recipe information from markdown content. Return the data in a consistent JSON format. When ingredients use US imperial measurements (cups, ounces, pounds, etc.), add metric conversions in parentheses at the end of each ingredient (e.g., '1 cup flour (120g)', '1 lb beef (454g)')."
          },
          {
            role: "user",
            content: `Extract the recipe information from this markdown content:\n\n${markdown}\n\nReturn a JSON object with title, description, ingredients (as array with metric conversions), steps (as array), meal_type, and cuisine.`
          }
        ],
      })
      
      imageUrl = ogImage
    } else if (image) {
      // Convert image to base64
      const bytes = await image.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64Image = buffer.toString('base64')

      // New image extraction logic using GPT-4 Vision
      completion = await new OpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts recipe information from images. Return the data in a consistent JSON format. Keep the language the same as the original recipe. Include meal_type and cuisine fields in your response."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the recipe information from this image. Return a JSON object with title, description, ingredients (as array), steps (as array). Keep the language the same as the original recipe." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${image.type};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      });

      // Upload the image to Supabase
      const fileExt = image.name.split('.').pop() || 'jpg'
      const fileName = `${Math.random()}.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('recipes')
        .upload(fileName, image)
      
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('recipes')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
      }
    } else {
      throw new Error('Neither URL nor image provided')
    }

    const result = completion.choices[0].message?.content
    if (!result) throw new Error('No result from OpenAI')

    // Clean the response before parsing
    const cleanedResult = result
      .replace(/```json\n?/g, '')  // Remove ```json
      .replace(/```\n?/g, '')      // Remove closing ```
      .trim()                      // Remove any extra whitespace

    const recipeData = JSON.parse(cleanedResult)

    // Add image URL if available
    if (imageUrl) {
      recipeData.image_url = imageUrl
    }

    return NextResponse.json(recipeData)
  } catch (error: unknown) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error && error.message?.includes('HEIC') 
      ? 'Failed to process HEIC image. Please try converting it to JPEG first.'
      : 'Failed to extract recipe'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}