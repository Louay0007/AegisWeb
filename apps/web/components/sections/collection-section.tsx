"use client";

import { FadeImage } from "@/components/fade-image";

const workflows = [
  {
    id: 1,
    name: "Invoice Download",
    description: "Agents log into approved vendor portals, collect invoices, and create receipts.",
    price: "Read",
    image: "/images/hero-side-1.png",
  },
  {
    id: 2,
    name: "Renewal Check",
    description: "Detect renewal dates, price increases, seat usage, and risky plan changes.",
    price: "Review",
    image: "/images/hero-side-2.png",
  },
  {
    id: 3,
    name: "Plan Change",
    description: "Pause cancellations, downgrades, and purchases until a human approves.",
    price: "Approve",
    image: "/images/hero-side-4.png",
  },
];

export function CollectionSection() {
  return (
    <section id="accessories" className="bg-background">
      {/* Section Title */}
      <div className="px-6 py-20 md:px-12 lg:px-20 md:py-10">
        <h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          Safe Agent Workflows
        </h2>
      </div>

      {/* Workflow Grid/Carousel */}
      <div className="pb-24">
        {/* Mobile: Horizontal Carousel */}
        <div className="flex gap-6 overflow-x-auto px-6 pb-4 md:hidden snap-x snap-mandatory scrollbar-hide">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="group flex-shrink-0 w-[75vw] snap-center">
              {/* Image */}
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-secondary">
                <FadeImage
                  src={workflow.image || "/placeholder.svg"}
                  alt={workflow.name}
                  fill
                  className="object-cover group-hover:scale-105"
                />
              </div>

              {/* Content */}
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-foreground">
                      {workflow.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {workflow.description}
                    </p>
                  </div>
                  <span className="text-lg font-medium text-foreground">
                    {workflow.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-3 gap-8 md:px-12 lg:px-20">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="group">
              {/* Image */}
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-secondary">
                <FadeImage
                  src={workflow.image || "/placeholder.svg"}
                  alt={workflow.name}
                  fill
                  className="object-cover group-hover:scale-105"
                />
              </div>

              {/* Content */}
              <div className="py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium leading-snug text-foreground">
                      {workflow.name}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {workflow.description}
                    </p>
                  </div>
                  <span className="font-medium text-foreground text-2xl">
                    {workflow.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
