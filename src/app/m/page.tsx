import type { Metadata } from "next";
import { getSlots } from "@/lib/warehouse";
import { MobileSearch } from "./MobileSearch";

export const metadata: Metadata = { title: "ค้นหาสินค้า" };

export default async function MobilePage() {
  return <MobileSearch slots={await getSlots()} />;
}
