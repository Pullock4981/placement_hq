import { PlacementStoreProvider } from '@/lib/placement/store';

export default function MentorRiskLayout({ children }: { children: React.ReactNode }) {
  return <PlacementStoreProvider>{children}</PlacementStoreProvider>;
}
