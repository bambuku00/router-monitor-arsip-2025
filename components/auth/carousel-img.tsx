"use client";

import React, { useCallback, useState } from "react";
import Image from "next/image";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/shadcnui/carousel";
import { type CarouselApi } from "@/components/shadcnui/carousel";
import WP1 from "@/public/misc/wp1.jpg";
import WP2 from "@/public/misc/wp2.jpg";
import WP3 from "@/public/misc/wp3.jpg";
import WP4 from "@/public/misc/wp4.jpg";
import { MdArrowBackIosNew } from "react-icons/md";

export default function CarouselImg() {
  const [api, setApi] = useState<CarouselApi>();

  const scrollPrev = useCallback(() => {
    if (api) api.scrollPrev();
  }, [api]);

  const scrollNext = useCallback(() => {
    if (api) api.scrollNext();
  }, [api]);

  return (
    <section className="hidden sm:block flex-1">
      <Carousel
        className="h-full"
        opts={{
          loop: true,
        }}
        plugins={[
          Autoplay({
            delay: 5000,
          }),
        ]}
        setApi={setApi}
      >
        <CarouselContent className="ml-0 h-full">
          {[WP1, WP2, WP3, WP4].map((val, i) => (
            <CarouselItem className="pl-0" key={"wp-carousel-" + i}>
              <Image
                alt={"wp-" + i}
                placeholder="blur"
                quality={100}
                src={val}
                className="h-full w-full object-cover"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <button
          type="button"
          className="absolute left-5 top-1/2 -translate-y-1/2 p-2.5 bg-slate-600 opacity-20 hover:opacity-30 rounded-full"
          onClick={scrollPrev}
        >
          <MdArrowBackIosNew className="size-3.5 text-white" />
        </button>
        <button
          type="button"
          className="absolute right-5 top-1/2 -translate-y-1/2 p-2.5 bg-slate-600 opacity-20 hover:opacity-30 rounded-full"
          onClick={scrollNext}
        >
          <MdArrowBackIosNew className="size-3.5 text-white rotate-180" />
        </button>
      </Carousel>
    </section>
  );
}
