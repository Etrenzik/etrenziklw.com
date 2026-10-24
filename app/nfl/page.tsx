import { GridPageContent } from "@/components/grid/GridPageContent";

// Mirrors app/page.tsx: render the grid directly rather than redirecting, so a
// static export's NFL landing page shows real content immediately.
export default async function NflHome() {
  return <GridPageContent league="nfl" />;
}
