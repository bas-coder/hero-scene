import type { Metadata } from "next";
import { DesignSystem } from "../../design/DesignSystem";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false },
};

export default function DesignSystemPage() {
  return <DesignSystem />;
}
