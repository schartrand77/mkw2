import { NextResponse } from 'next/server'
import { requireAdmin } from '@/app/api/admin/_utils'
import { generateAndStoreOrderReceipt } from '@/lib/receipts/order-receipts'

type Context = { params: Promise<{ orderId: string }> }

export const dynamic = 'force-dynamic'

async function handleReceipt({ params }: Context) {
  try {
    await requireAdmin()
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  const { orderId } = await params
  try {
    const result = await generateAndStoreOrderReceipt(orderId)
    return new NextResponse(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${result.model.orderNumber}-receipt.pdf"`,
        'cache-control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unable to generate receipt.' }, { status: err?.message === 'Order not found' ? 404 : 500 })
  }
}

export async function GET(_req: Request, context: Context) {
  return handleReceipt(context)
}

export async function POST(_req: Request, context: Context) {
  return handleReceipt(context)
}
