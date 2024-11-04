export interface Recipe {
  id: number
  title: string
  description: string
  image_url: string
  ingredients: any // or more specifically: Record<string, any>
  steps: any // or more specifically: Record<string, any>
  created_at: string
  user_id: string
  image_source_url: string
  meal_type: string
  cuisine: string
  is_favorite: boolean
} 