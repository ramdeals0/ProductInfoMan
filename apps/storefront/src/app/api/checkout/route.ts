import { NextResponse } from "next/server";
import Stripe from "stripe";

type CheckoutItem = {
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
};

export async function POST(request: Request) {
  let body: { items?: CheckoutItem[] };
  try {
    body = (await request.json()) as { items?: CheckoutItem[] };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const items = body.items ?? [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ mode: "mock", success: true });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
  const stripe = new Stripe(stripeKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cart`,
      line_items: items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(item.price * 100),
          product_data: {
            name: item.name,
            metadata: {
              productId: item.productId,
              sku: item.sku,
            },
          },
        },
      })),
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
    }

    return NextResponse.json({ mode: "stripe", url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
