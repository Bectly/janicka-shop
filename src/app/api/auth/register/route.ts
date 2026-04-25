import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { getDb } from "@/lib/db";
import { rateLimitLogin } from "@/lib/rate-limit";
import { sendAccountWelcomeEmail } from "@/lib/email";

const registerSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
  firstName: z.string().min(1, "Jméno je povinné").max(80),
  lastName: z.string().min(1, "Příjmení je povinné").max(80),
});

export async function POST(request: Request) {
  const rl = await rateLimitLogin();
  if (!rl.success) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů. Zkuste to za chvíli." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatná data" },
      { status: 400 }
    );
  }

  const { email, password, firstName, lastName } = parsed.data;
  const db = await getDb();

  const existing = await db.customer.findUnique({ where: { email } });
  if (existing?.password) {
    return NextResponse.json(
      { error: "Účet s tímto emailem již existuje" },
      { status: 409 }
    );
  }

  const hashedPassword = await hash(password, 12);

  if (existing) {
    // Customer record from prior guest checkout — attach password + update name
    await db.customer.update({
      where: { id: existing.id },
      data: {
        password: hashedPassword,
        firstName: existing.firstName || firstName,
        lastName: existing.lastName || lastName,
      },
    });
  } else {
    await db.customer.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
    });
  }

  void sendAccountWelcomeEmail({ email, firstName });

  return NextResponse.json({ success: true });
}
