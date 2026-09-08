import { Link } from 'react-router';
import { CarTaxiFront } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <CarTaxiFront className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold">Cette page n’existe pas</h1>
      <p className="text-muted-foreground">
        Le lien est peut-être ancien ou mal recopié. Revenez à l’accueil pour
        commander une course.
      </p>
      <Button render={<Link to="/" />}>Retour à l’accueil</Button>
    </div>
  );
}