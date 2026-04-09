import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "Tvoje fotky jsou tvoje. Vždy. — Janička chrání tvoje soukromí.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Shield icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "#ffe4e6",
            marginBottom: 32,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e11d48"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#1a1a1a",
              letterSpacing: "-0.02em",
            }}
          >
            Tvoje fotky jsou tvoje.
          </span>
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#e11d48",
              letterSpacing: "-0.02em",
            }}
          >
            Vždy.
          </span>
        </div>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 24,
            color: "#71717a",
            marginTop: 24,
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Zatímco jiné platformy trénují AI na tvých fotkách, u nás je to jinak.
        </p>

        {/* Brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 48,
            fontSize: 20,
            color: "#a1a1aa",
          }}
        >
          <span>janička</span>
          <span style={{ color: "#e11d48" }}>·</span>
          <span>second hand móda</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
