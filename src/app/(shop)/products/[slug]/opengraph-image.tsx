import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/lib/products-cache";
import { parseProductImages, parseJsonStringArray } from "@/lib/images";
import { CONDITION_LABELS } from "@/lib/constants";

export const alt = "Janička — unikátní second hand kousek";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function formatPriceCzk(value: number): string {
  return `${new Intl.NumberFormat("cs-CZ").format(value)} Kč`;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function OgImage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(135deg, #f8f1ea 0%, #e9d5c6 100%)",
            fontSize: 72,
            fontWeight: 700,
            color: "#3d2a22",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          Janička
        </div>
      ),
      { ...size },
    );
  }

  const images = parseProductImages(product.images);
  const primaryImage = images[0]?.url ?? null;
  const sizes = parseJsonStringArray(product.sizes);
  const SIZE_SENTINELS = new Set(["Jiná", "Jina", "Univerzální", "Univerzalni", "UNI"]);
  const displaySize = sizes.find((s) => !SIZE_SENTINELS.has(s));
  const conditionLabel = CONDITION_LABELS[product.condition] ?? "";
  const sold = product.sold;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f8f1ea",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Left: product image */}
        <div
          style={{
            width: 600,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#e9d5c6",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {primaryImage ? (
            <img
              src={primaryImage}
              alt=""
              width={600}
              height={630}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                ...(sold ? { filter: "grayscale(1)", opacity: 0.7 } : {}),
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                fontSize: 120,
                color: "#8b5e4c",
                fontWeight: 700,
              }}
            >
              J
            </div>
          )}
          {sold && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                background: "rgba(42, 29, 23, 0.9)",
                color: "#fff",
                fontSize: 40,
                fontWeight: 700,
                padding: "14px 36px",
                borderRadius: 999,
              }}
            >
              Prodáno
            </div>
          )}
        </div>

        {/* Right: info panel */}
        <div
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 56px 56px 48px",
          }}
        >
          {/* Header: brand mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                background: "#8b5e4c",
                color: "#fff",
                fontSize: 26,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              J
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#3d2a22" }}>
              Janička
            </div>
          </div>

          {/* Body: brand, title, meta */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {product.brand && (
              <div
                style={{
                  fontSize: 24,
                  color: "#8b5e4c",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {product.brand}
              </div>
            )}
            <div
              style={{
                fontSize: 46,
                fontWeight: 700,
                lineHeight: 1.1,
                color: "#2a1d17",
                letterSpacing: -1,
                display: "-webkit-box",
                maxHeight: 165,
                overflow: "hidden",
              }}
            >
              {product.name}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {displaySize && (
                <div
                  style={{
                    fontSize: 22,
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "#fff",
                    color: "#3d2a22",
                    fontWeight: 600,
                  }}
                >
                  Velikost {displaySize}
                </div>
              )}
              {conditionLabel && (
                <div
                  style={{
                    fontSize: 22,
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "#fff",
                    color: "#3d2a22",
                    fontWeight: 600,
                  }}
                >
                  {conditionLabel}
                </div>
              )}
            </div>
          </div>

          {/* Footer: price + uniqueness */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: "#2a1d17",
                letterSpacing: -1.5,
              }}
            >
              {formatPriceCzk(product.price)}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 22,
                color: "#8b5e4c",
                fontWeight: 600,
              }}
            >
              <span>✦ Unikát — qty 1</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
