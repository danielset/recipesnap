import Image from 'next/image'
import Link from 'next/link'

interface RecipeCardProps {
  id: number
  title: string
  image: string
  description: string
}

const RecipeCard = ({ id, title, description, image }: RecipeCardProps) => {
  return (
    <Link href={`/recipe/${id}`} className="block h-full">
      <div className="flex flex-col h-full rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
        <div className="relative w-full aspect-[3/2]">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover rounded-t-lg"
          />
        </div>
        <div className="flex flex-col flex-grow p-4">
          <h3 className="text-lg font-semibold line-clamp-1">{title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        </div>
      </div>
    </Link>
  )
}

export default RecipeCard