import { NextResponse } from "next/server";

/**
 * Pin founder profile JSON to IPFS via Pinata (server-side JWT).
 * Set PINATA_JWT in frontend/.env.local (never commit).
 */
export async function POST(req: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "PINATA_JWT is not configured. Add it to .env.local to enable pinning." },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataOptions:  { cidVersion: 1 },
      pinataMetadata: { name: "holdr-founder-profile" },
      pinataContent:  body,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Pinata request failed", detail: text.slice(0, 500) },
      { status: 502 },
    );
  }

  const out = (await res.json()) as { IpfsHash?: string };
  if (!out.IpfsHash) {
    return NextResponse.json({ error: "No IpfsHash in Pinata response" }, { status: 502 });
  }

  return NextResponse.json({ cid: out.IpfsHash });
}
