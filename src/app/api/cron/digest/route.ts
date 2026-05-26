import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDigestEmail } from "@/lib/digest";
import { Resend } from "resend";

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 }
    );
  }

  const resend = new Resend(resendApiKey);
  const fromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";

  // Get current UTC hour
  const currentHour = new Date().getUTCHours();

  // Fetch all users — we need to match their local digest hour to current UTC hour.
  // For simplicity, we send to all users whose digestHour matches current UTC hour
  // or if digestHour is -1 (always send).
  // Users with timezone set: we'd need to convert. For now, treat digestHour as UTC.
  const users = await prisma.user.findMany({
    where: {
      email: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      digestHour: true,
      timezone: true,
    },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of users) {
    if (!user.email) {
      skipped++;
      continue;
    }

    // Check if this user's digest hour matches current UTC hour
    // Simple approach: convert user's local digest hour to UTC
    // For now, treat digestHour as UTC to keep things simple
    if (user.digestHour !== currentHour) {
      skipped++;
      continue;
    }

    try {
      const { subject, html } = await generateDigestEmail(user.id);

      await resend.emails.send({
        from: fromAddress,
        to: user.email,
        subject,
        html,
      });

      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`User ${user.id}: ${msg}`);
      skipped++;
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  });
}
