import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS: { key: string; description: string }[] = [
  { key: 'sales.create', description: 'Create sales / process POS transactions' },
  { key: 'sales.void', description: 'Void or cancel a sale' },
  { key: 'discounts.apply', description: 'Apply standard discounts at POS' },
  { key: 'discounts.apply_large', description: 'Apply discounts above the standard authorization limit' },
  { key: 'refunds.process', description: 'Process returns and refunds' },
  { key: 'products.view', description: 'View product catalog' },
  { key: 'products.edit', description: 'Create and edit products' },
  { key: 'products.price.edit', description: 'Change product prices' },
  { key: 'inventory.manage', description: 'Manage stock movements, damaged/expired stock' },
  { key: 'inventory.adjust', description: 'Perform manual stock adjustments' },
  { key: 'purchases.manage', description: 'Create and manage purchase orders' },
  { key: 'suppliers.manage', description: 'Create and edit suppliers' },
  { key: 'customers.manage', description: 'Create and edit customers' },
  { key: 'expenses.manage', description: 'Record and manage expenses' },
  { key: 'reports.view', description: 'View sales and inventory reports' },
  { key: 'profits.view', description: 'View profit and financial reports' },
  { key: 'users.manage', description: 'Create and manage user accounts' },
  { key: 'settings.manage', description: 'Change system, store and POS settings' },
  { key: 'audit_logs.view', description: 'View audit logs' },
  { key: 'cash_register.manage', description: 'Open/close cash drawer sessions' },
  { key: 'backup.manage', description: 'Create and restore database backups' },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key),
  MANAGER: [
    'sales.create', 'sales.void', 'discounts.apply', 'discounts.apply_large',
    'refunds.process', 'products.view', 'products.edit', 'products.price.edit',
    'inventory.manage', 'inventory.adjust', 'purchases.manage', 'suppliers.manage',
    'customers.manage', 'expenses.manage', 'reports.view', 'profits.view',
    'cash_register.manage', 'audit_logs.view',
  ],
  CASHIER: [
    'sales.create', 'discounts.apply', 'refunds.process', 'products.view',
    'customers.manage', 'cash_register.manage',
  ],
  INVENTORY_MANAGER: [
    'products.view', 'products.edit', 'inventory.manage', 'inventory.adjust',
    'purchases.manage', 'suppliers.manage', 'reports.view',
  ],
  ACCOUNTANT: [
    'reports.view', 'profits.view', 'expenses.manage', 'audit_logs.view', 'suppliers.manage',
  ],
};

const UNITS: { name: string; abbreviation: string; isFractional: boolean }[] = [
  { name: 'Piece', abbreviation: 'pc', isFractional: false },
  { name: 'Box', abbreviation: 'box', isFractional: false },
  { name: 'Packet', abbreviation: 'pkt', isFractional: false },
  { name: 'Dozen', abbreviation: 'dz', isFractional: false },
  { name: 'Kilogram', abbreviation: 'kg', isFractional: true },
  { name: 'Gram', abbreviation: 'g', isFractional: true },
  { name: 'Liter', abbreviation: 'L', isFractional: true },
  { name: 'Milliliter', abbreviation: 'mL', isFractional: true },
  { name: 'Meter', abbreviation: 'm', isFractional: true },
];

const DEMO_USERS: { name: string; username: string; email: string; password: string; role: string }[] = [
  { name: 'System Administrator', username: 'admin', email: 'admin@example.com', password: 'Admin@12345', role: 'ADMIN' },
  { name: 'Store Manager', username: 'manager1', email: 'manager1@example.com', password: 'Manager@12345', role: 'MANAGER' },
  { name: 'Front Cashier', username: 'cashier1', email: 'cashier1@example.com', password: 'Cashier@12345', role: 'CASHIER' },
  { name: 'Inventory Lead', username: 'inventory1', email: 'inventory1@example.com', password: 'Inventory@12345', role: 'INVENTORY_MANAGER' },
  { name: 'Store Accountant', username: 'accountant1', email: 'accountant1@example.com', password: 'Accountant@12345', role: 'ACCOUNTANT' },
];

async function main() {
  const demo = process.env.SEED_DEMO === 'true';
  if(!demo && (!process.env.INITIAL_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD.length < 12)) throw new Error('Set INITIAL_ADMIN_PASSWORD (12+ characters) for a clean store, or SEED_DEMO=true for disposable demo data');
  console.log('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log('Seeding roles + role-permissions...');
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role` },
    });

    const permissions = await prisma.permission.findMany({ where: { key: { in: permKeys } } });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log('Seeding units...');
  for (const unit of UNITS) {
    await prisma.unit.upsert({
      where: { name: unit.name },
      update: unit,
      create: unit,
    });
  }

  console.log('Seeding default tax...');
  const existingTax = await prisma.tax.findFirst({ where: { name: 'Standard Tax' } });
  if (!existingTax) {
    await prisma.tax.create({ data: { name: 'Standard Tax', rate: 17, isInclusive: false } });
  }

  console.log('Seeding terminal...');
  await prisma.terminal.upsert({
    where: { name: 'POS-1' },
    update: {},
    create: { name: 'POS-1', location: 'Front Counter' },
  });

  console.log('Seeding demo users...');
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);
  const users = demo ? DEMO_USERS : [{name:'Store Administrator',username:process.env.INITIAL_ADMIN_USERNAME??'admin',email:'admin@example.com',password:process.env.INITIAL_ADMIN_PASSWORD!,role:'ADMIN'}];
  for (const u of users) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: u.role } });
    const passwordHash = await bcrypt.hash(u.password, saltRounds);
    await prisma.user.upsert({
      where: { username: u.username },
      update: { name: u.name, email: u.email, roleId: role.id },
      create: {
        name: u.name,
        username: u.username,
        email: u.email,
        passwordHash,
        roleId: role.id,
      },
    });
  }

  if(!demo) {console.log('Store initialized. No demo products, customers or shared demo passwords were created.');return;}
  console.log('Seeding demo catalog data...');
  const categoryNames = ['Grocery', 'Beverages', 'Dairy & Eggs', 'Household'];
  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const existing = await prisma.category.findFirst({ where: { name } });
    const category = existing ?? (await prisma.category.create({ data: { name } }));
    categories[name] = category.id;
  }

  const brandNames = ['Nestlé', 'Coca-Cola', 'Local Farm'];
  const brands: Record<string, string> = {};
  for (const name of brandNames) {
    const brand = await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
    brands[name] = brand.id;
  }

  const unitByName = async (name: string) => (await prisma.unit.findUniqueOrThrow({ where: { name } })).id;
  const pieceId = await unitByName('Piece');
  const kgId = await unitByName('Kilogram');
  const literId = await unitByName('Liter');

  const products: {
    name: string; sku: string; barcode: string; categoryId: string; brandId?: string; unitId: string;
    purchasePrice: string; sellingPrice: string; currentStock: string; minStock: string; isWeighted?: boolean;
  }[] = [
    { name: 'Basmati Rice 1kg', sku: 'GRO-0001', barcode: '8901030811188', categoryId: categories['Grocery'], unitId: pieceId, purchasePrice: '250.00', sellingPrice: '310.00', currentStock: '120', minStock: '20' },
    { name: 'Cooking Oil 1L', sku: 'GRO-0002', barcode: '8901030811195', categoryId: categories['Grocery'], unitId: pieceId, purchasePrice: '480.00', sellingPrice: '560.00', currentStock: '80', minStock: '15' },
    { name: 'Loose Tomatoes', sku: 'GRO-0003', barcode: '8901030811201', categoryId: categories['Grocery'], unitId: kgId, purchasePrice: '90.00', sellingPrice: '130.00', currentStock: '45.500', minStock: '10', isWeighted: true },
    { name: 'Milk 1L', sku: 'DAI-0001', barcode: '8901030811218', categoryId: categories['Dairy & Eggs'], brandId: brands['Local Farm'], unitId: pieceId, purchasePrice: '160.00', sellingPrice: '190.00', currentStock: '60', minStock: '15' },
    { name: 'Coca-Cola 1.5L', sku: 'BEV-0001', barcode: '8901030811225', categoryId: categories['Beverages'], brandId: brands['Coca-Cola'], unitId: pieceId, purchasePrice: '140.00', sellingPrice: '175.00', currentStock: '96', minStock: '24' },
    { name: 'Nescafé Classic 50g', sku: 'BEV-0002', barcode: '8901030811232', categoryId: categories['Beverages'], brandId: brands['Nestlé'], unitId: pieceId, purchasePrice: '520.00', sellingPrice: '620.00', currentStock: '30', minStock: '8' },
    { name: 'Dish Soap 500ml', sku: 'HH-0001', barcode: '8901030811249', categoryId: categories['Household'], unitId: pieceId, purchasePrice: '150.00', sellingPrice: '195.00', currentStock: '3', minStock: '10' },
    { name: 'Fresh Milk (Loose)', sku: 'DAI-0002', barcode: '', categoryId: categories['Dairy & Eggs'], brandId: brands['Local Farm'], unitId: literId, purchasePrice: '150.00', sellingPrice: '185.00', currentStock: '18.000', minStock: '5', isWeighted: true },
  ];

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) continue;
    await prisma.product.create({
      data: {
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || undefined,
        categoryId: p.categoryId,
        brandId: p.brandId,
        unitId: p.unitId,
        purchasePrice: p.purchasePrice,
        sellingPrice: p.sellingPrice,
        currentStock: p.currentStock,
        minStock: p.minStock,
        isWeighted: p.isWeighted ?? false,
      },
    });
  }

  console.log('Seeding demo customers...');
  const demoCustomers = [
    { name: 'Ayesha Khan', phone: '0301-1234567', type: 'REGISTERED' as const },
    { name: 'Bilal Ahmed', phone: '0300-7654321', type: 'CREDIT' as const, creditLimit: '5000.00' },
  ];
  for (const c of demoCustomers) {
    const existing = await prisma.customer.findUnique({ where: { phone: c.phone } });
    if (!existing) await prisma.customer.create({ data: c });
  }

  console.log('Seeding demo suppliers...');
  const demoSuppliers = [
    { name: 'Karachi Wholesale Traders', company: 'KWT Distribution', phone: '021-1112222', openingBalance: '0.00' },
    { name: 'National Beverages Co.', company: 'Coca-Cola Pakistan Bottler', phone: '021-3334444', openingBalance: '15000.00' },
  ];
  for (const s of demoSuppliers) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.supplier.create({ data: s });
  }

  console.log('\nSeed complete. Demo login credentials (change immediately in production):');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(18)} username=${u.username.padEnd(12)} password=${u.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
