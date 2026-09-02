import { GridPageContent } from "@/components/grid/GridPageContent";

// Renders the grid directly rather than client-side redirecting to /grid —
// a static export's homepage should show real content immediately, not
// depend on JS executing before anything appears.
export default async function Home() {
  return <GridPageContent />;
}
