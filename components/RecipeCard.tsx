import Image from 'next/image'
import Link from 'next/link'

interface RecipeCardProps {
  id: number
  title: string
  description: string
  image: string
  meal_type?: string
  cuisine?: string
}

const RecipeCard = ({ id, title, description, image, meal_type, cuisine }: RecipeCardProps) => {
  return (
    <Link href={`/recipe/${id}`}>
      <div className="group h-full rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:shadow-lg">
        <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover transition-all group-hover:scale-105"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {meal_type && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {meal_type}
            </span>
          )}
          {cuisine && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              {cuisine}
            </span>
          )}
        </div>

        <div className="p-4 pt-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">{description}</p>
        </div>
      </div>
    </Link>
  )
}

export default RecipeCard