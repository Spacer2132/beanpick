"use client";

import Image from "next/image";

interface BeanCardProps {
  name: string;
  origin: string;
  image: string;
  cupNotes: string[];
  roastLevel?: string;
}

export function BeanCard({ name, origin, image, cupNotes, roastLevel }: BeanCardProps) {
  return (
    <div className="group cursor-pointer">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted mb-3">
        <Image
          src={image}
          alt={`${name} coffee beans from ${origin}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {roastLevel && (
          <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <span className="text-xs font-medium text-card-foreground">{roastLevel}</span>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div>
          <h3 className="font-medium text-foreground text-sm leading-tight">{name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{origin}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cupNotes.slice(0, 3).map((note) => (
            <span
              key={note}
              className="text-[10px] px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full font-medium"
            >
              {note}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
