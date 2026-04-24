import { ImageResponse } from "next/og";
import { getDb } from "@/lib/db";

export const alt = "Janička — Second hand móda s duší";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function getNewProductsCount(): Promise<number> {
  try {
    const db = await getDb();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return db.product.count({
      where: { active: true, sold: false, createdAt: { gte: thirtyDaysAgo } },
    });
  } catch {
    return 0;
  }
}

export default async function OgImage() {
  const count = await getNewProductsCount();
  const countLabel =
    count > 0
      ? `${count} ${count === 1 ? "nový kousek" : count < 5 ? "nové kousky" : "nových kousků"} za posledních 30 dní`
      : "Unikátní kousky s příběhem";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #f8f1ea 0%, #f3e7dc 50%, #e9d5c6 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              background: "#8b5e4c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            J
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: "#3d2a22",
              letterSpacing: -1,
            }}
          >
            Janička
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#2a1d17",
              letterSpacing: -2,
              maxWidth: 960,
            }}
          >
            Second hand móda s duší
          </div>
          <div
            style={{
              fontSize: 36,
              color: "#6b4a3c",
              fontWeight: 500,
            }}
          >
            {countLabel}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28,
            color: "#6b4a3c",
          }}
        >
          <div style={{ display: "flex", gap: 28 }}>
            <span>✦ Každý kus unikát</span>
            <span>✦ Doprava zdarma od 1 500 Kč</span>
          </div>
          <div style={{ fontWeight: 600, color: "#8b5e4c" }}>janicka-shop.cz</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
