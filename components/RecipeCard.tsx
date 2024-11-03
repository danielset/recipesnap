import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface RecipeCardProps {
  id: number
  title: string
  image: string
  description: string
}

export default function RecipeCard({ id, title, image, description }: RecipeCardProps) {
  return (
    <Card className="overflow-hidden">
      <Image src={image} alt={title} width={300} height={200} className="w-full object-cover h-48" />
      <CardContent className="p-4">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-gray-600 mb-4">{description}</p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Link href={`/recipe/${id}`}>
          <Button variant="outline">View Recipe</Button>
        </Link>
      </CardFooter>
    </Card>
  )
}