import { Header } from "@/components/header";
import { SearchBar } from "@/components/search-bar";
import { FilterChips } from "@/components/filter-chips";
import { BeanCard } from "@/components/bean-card";

const coffeeBeansData = [
  {
    id: 1,
    name: "Yirgacheffe Natural",
    origin: "Ethiopia",
    image: "/images/bean-ethiopia.jpg",
    cupNotes: ["Floral", "Berry", "Citrus"],
    roastLevel: "Light",
  },
  {
    id: 2,
    name: "Huila Supremo",
    origin: "Colombia",
    image: "/images/bean-colombia.jpg",
    cupNotes: ["Chocolate", "Caramel", "Nuts"],
    roastLevel: "Medium",
  },
  {
    id: 3,
    name: "Antigua Volcanic",
    origin: "Guatemala",
    image: "/images/bean-guatemala.jpg",
    cupNotes: ["Honey", "Spicy", "Chocolate"],
    roastLevel: "Medium-Dark",
  },
  {
    id: 4,
    name: "Nyeri AA",
    origin: "Kenya",
    image: "/images/bean-kenya.jpg",
    cupNotes: ["Berry", "Citrus", "Floral"],
    roastLevel: "Light",
  },
  {
    id: 5,
    name: "Mogiana Natural",
    origin: "Brazil",
    image: "/images/bean-brazil.jpg",
    cupNotes: ["Nuts", "Chocolate", "Caramel"],
    roastLevel: "Medium",
  },
  {
    id: 6,
    name: "Tarrazú Honey",
    origin: "Costa Rica",
    image: "/images/bean-costa-rica.jpg",
    cupNotes: ["Honey", "Citrus", "Fruity"],
    roastLevel: "Light-Medium",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Container */}
      <div className="mx-auto max-w-md">
        {/* Fixed Header Area */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          <div className="px-5 pt-6 pb-4 space-y-5">
            <Header />
            <SearchBar />
          </div>
        </div>

        {/* Main Content */}
        <main className="px-5 pb-8">
          {/* Filter Section */}
          <section className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Cup Notes
              </h2>
              <button className="text-xs text-accent font-medium hover:underline">
                Clear all
              </button>
            </div>
            <FilterChips />
          </section>

          {/* Bean Grid Section */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                Discover Beans
              </h2>
              <span className="text-sm text-muted-foreground">
                {coffeeBeansData.length} results
              </span>
            </div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-2 gap-4">
              {coffeeBeansData.map((bean) => (
                <BeanCard
                  key={bean.id}
                  name={bean.name}
                  origin={bean.origin}
                  image={bean.image}
                  cupNotes={bean.cupNotes}
                  roastLevel={bean.roastLevel}
                />
              ))}
            </div>
          </section>

          {/* Load More */}
          <div className="mt-8 flex justify-center">
            <button className="px-6 py-3 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
              Load More Beans
            </button>
          </div>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border">
          <div className="mx-auto max-w-md px-5 py-3">
            <div className="flex items-center justify-around">
              <NavItem icon="home" label="Home" active />
              <NavItem icon="compass" label="Explore" />
              <NavItem icon="heart" label="Favorites" />
              <NavItem icon="user" label="Profile" />
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) {
  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    compass: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    heart: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    user: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  };

  return (
    <button className={`flex flex-col items-center gap-1 ${active ? "text-foreground" : "text-muted-foreground"}`}>
      {icons[icon]}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
