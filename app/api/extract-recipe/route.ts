import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { supabase } from '@/utils/supabase'
import heicConvert from 'heic-convert'
import FirecrawlApp from '@mendable/firecrawl-js'
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export const maxDuration = 60 // 5 minutes
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

async function getInstagramContent(url: string): Promise<{ description: string | null, imageUrl: string | null }> {
  try {
    console.log('Processing Instagram URL:', url);
    
    // Create a temporary Python script
    const pythonScript = `
import instaloader
from urllib.parse import urlparse

def extract_post_data(post_url):
    try:
        L = instaloader.Instaloader(
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            quiet=True
        )
        
        path = urlparse(post_url).path
        shortcode = path.split('/')[-2]
        
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        print("CAPTION_START")
        print(post.caption or "")
        print("CAPTION_END")
        
        print("IMAGE_URL_START")
        print(post.url)
        print("IMAGE_URL_END")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")

import sys
extract_post_data(sys.argv[1])
    `;

    const scriptPath = path.join(process.cwd(), 'temp_instagram_script.py');
    await fs.writeFile(scriptPath, pythonScript);

    try {
      const data = await new Promise<string>((resolve, reject) => {
        let output = '';
        let error = '';

        const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
        const pythonProcess = spawn(pythonCommand, [scriptPath, url]);

        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          error += data.toString();
        });

        pythonProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Python process exited with code ${code}\n${error}`));
          } else {
            resolve(output);
          }
        });
      });

      // Clean up the temporary script
      await fs.unlink(scriptPath).catch(console.error);

      // Parse the output
      const captionMatch = data.match(/CAPTION_START\n([\s\S]*?)\nCAPTION_END/);
      const imageUrlMatch = data.match(/IMAGE_URL_START\n([\s\S]*?)\nIMAGE_URL_END/);

      const description = captionMatch ? captionMatch[1].trim() : null;
      const imageUrl = imageUrlMatch ? imageUrlMatch[1].trim() : null;

      console.log('Extracted content:', {
        hasDescription: !!description,
        descriptionPreview: description?.substring(0, 100),
        hasImage: !!imageUrl,
        imageUrlPreview: imageUrl?.substring(0, 100)
      });

      return { description, imageUrl };
    } finally {
      // Ensure cleanup even if there's an error
      await fs.unlink(scriptPath).catch(console.error);
    }
  } catch (error) {
    console.error('Error in getInstagramContent:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const url = formData.get('url') as string | null
    let image = formData.get('image') as File | null
    const isInstagram = formData.get('isInstagram') as string | null

    console.log('Received request:', { url, isInstagram });

    // Convert HEIC to JPEG if necessary
    if (image && image.type.toLowerCase().includes('heic')) {
      image = await convertHeicToJpeg(image)
    }

    let completion;
    let imageUrl = null;

    if (url && isInstagram === 'true') {
      // Handle Instagram extraction
      const { description, imageUrl: instaImageUrl } = await getInstagramContent(url)
      
      if (!description) {
        return NextResponse.json(
          { error: 'Could not extract content from Instagram post' },
          { status: 400 }
        )
      }

      completion = await new OpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts recipe information from Instagram post descriptions. Return the data in a consistent JSON format. When ingredients use US imperial measurements (cups, ounces, pounds, etc.), add metric conversions in parentheses."
          },
          {
            role: "user",
            content: `Extract the recipe information from this Instagram post:\n\n${description}\n\nReturn a JSON object with title, description, ingredients (as array with metric conversions), steps (as array), meal_type, and cuisine.`
          }
        ],
      })
      
      imageUrl = instaImageUrl
    } else if (url) {
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
                  url: `data:${image.type};base64,${base64Image}`,
                  detail: "high"
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
  } catch (error: any) {
    console.error('API Error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to extract recipe',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    )
  }
}