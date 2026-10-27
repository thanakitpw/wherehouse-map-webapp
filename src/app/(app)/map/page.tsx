import type { Metadata } from "next";
import { getCustomerOptions, getSlots } from "@/lib/warehouse";
import { MapView } from "./MapView";

export const metadata: Metadata = { title: "ผังคลัง" };

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const [{ q, sel }, slots, customers] = await Promise.all([searchParams, getSlots(), getCustomerOptions()]);
  return (
    <MapView
      slots={slots}
      customers={customers}
      initialQuery={typeof q === "string" ? q : ""}
      initialSel={typeof sel === "string" ? sel : undefined}
    />
  );
}
