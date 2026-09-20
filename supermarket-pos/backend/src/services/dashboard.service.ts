import { prisma } from '../config/database';
import { Prisma } from '../generated/prisma';
import { getLowStockProducts, getOutOfStockProducts } from './inventory.service';

export async function getDashboardSummary() {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [todaySales, lowStock, outOfStock, creditPayments, customerPayments, creditRefunds, todayRefunds] = await Promise.all([
    prisma.sale.aggregate({
      where: { createdAt: { gte: startOfDay }, status: {not:'CANCELLED'} },
      _sum: { total: true },
      _count: true,
    }),
    getLowStockProducts(),
    getOutOfStockProducts(),
    prisma.payment.aggregate({
      where: { method: 'CREDIT', sale: { status: { not: 'CANCELLED' } } },
      _sum: { amount: true },
    }),
    prisma.customerPayment.aggregate({ _sum: { amount: true } }),
    prisma.return.aggregate({where:{refundMethod:'CREDIT'},_sum:{totalRefund:true}}),
    prisma.return.aggregate({where:{createdAt:{gte:startOfDay}},_sum:{totalRefund:true}}),
  ]);

  const pendingPayments = (creditPayments._sum.amount ?? new Prisma.Decimal(0)).sub(
    customerPayments._sum.amount ?? new Prisma.Decimal(0),
  ).sub(creditRefunds._sum.totalRefund??0);

  return {
    todaySalesTotal: (todaySales._sum.total ?? new Prisma.Decimal(0)).sub(todayRefunds._sum.totalRefund??0).toFixed(2),
    todayTransactionCount: todaySales._count,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    pendingPayments: pendingPayments.toFixed(2),
  };
}
