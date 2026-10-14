import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLibraryItem, libraryItems } from "../../../content/library";
import { DemoHost } from "../../../library/demos/DemoHost";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return libraryItems.filter((item) => item.demo).map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const item = getLibraryItem((await params).slug);
  return {
    title: item ? `${item.title} demo` : "Demo",
    robots: { index: false },
  };
}

export default async function DemoPage({ params }: Params) {
  const item = getLibraryItem((await params).slug);
  if (!item?.demo) notFound();
  return <DemoHost slug={item.slug} />;
}
