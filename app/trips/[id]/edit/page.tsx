import { notFound } from "next/navigation";
import TripForm from "@/components/TripForm";
import { getTrip } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const trip = Number.isInteger(id) ? getTrip(id) : undefined;
  if (!trip) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Edit trip</h1>
      <TripForm trip={trip} />
    </div>
  );
}
