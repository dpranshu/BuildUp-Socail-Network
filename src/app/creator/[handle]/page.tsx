import ProfilePage from "@/app/profile/page";

type CreatorPageProps = {
  params: Promise<{ handle: string }>;
};

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { handle } = await params;
  return <ProfilePage handle={decodeURIComponent(handle)} />;
}
