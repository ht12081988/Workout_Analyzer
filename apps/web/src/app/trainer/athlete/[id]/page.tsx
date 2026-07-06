import { redirect } from "next/navigation";

export default function AthleteRootPage({ params }: { params: { id: string } }) {
  redirect(`/trainer/athlete/${params?.id}/exercises`);
}
