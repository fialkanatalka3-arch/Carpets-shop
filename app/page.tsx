import Storefront from "./storefront";
import { getCatalog } from "@/lib/catalog";
export default function Home() { return <Storefront products={getCatalog()} />; }
