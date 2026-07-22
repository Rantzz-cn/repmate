import { ExerciseDetails } from "@/components/exercise-details";
import { exercises } from "@/lib/data";

export function generateStaticParams() {
  return exercises.map((exercise) => ({ id: exercise.id }));
}

export default async function ExerciseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExerciseDetails id={id} />;
}
