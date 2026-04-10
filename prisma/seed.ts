import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Guard: don't wipe real data if products already exist
  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    console.log(
      `Seed skipped: ${existingProducts} products already in DB. Use import scripts for real data.`
    );

    // Still ensure admin and categories exist (upsert)
    const adminPassword = await hash("admin123", 12);
    await prisma.admin.upsert({
      where: { email: "janicka@shop.cz" },
      update: {},
      create: {
        email: "janicka@shop.cz",
        password: adminPassword,
        name: "Janička",
        role: "admin",
      },
    });

    const categoryData = [
      { name: "Šaty", slug: "saty", description: "Elegantní i každodenní šaty pro každou příležitost", sortOrder: 1 },
      { name: "Topy & Halenky", slug: "topy-halenky", description: "Stylové topy, halenky a trička", sortOrder: 2 },
      { name: "Kalhoty & Sukně", slug: "kalhoty-sukne", description: "Pohodlné kalhoty a elegantní sukně", sortOrder: 3 },
      { name: "Bundy & Kabáty", slug: "bundy-kabaty", description: "Svrchní oblečení pro každé počasí", sortOrder: 4 },
      { name: "Doplňky", slug: "doplnky", description: "Šperky, kabelky, šátky a další doplňky", sortOrder: 5 },
    ];

    for (const cat of categoryData) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
    }

    console.log("Seed: admin + categories ensured (upsert). Products untouched.");
    return;
  }

  // Fresh DB: create admin + categories only (no mock products)
  await prisma.admin.deleteMany();
  await prisma.category.deleteMany();

  const adminPassword = await hash("admin123", 12);
  await prisma.admin.create({
    data: {
      email: "janicka@shop.cz",
      password: adminPassword,
      name: "Janička",
      role: "admin",
    },
  });

  await Promise.all([
    prisma.category.create({
      data: {
        name: "Šaty",
        slug: "saty",
        description: "Elegantní i každodenní šaty pro každou příležitost",
        sortOrder: 1,
      },
    }),
    prisma.category.create({
      data: {
        name: "Topy & Halenky",
        slug: "topy-halenky",
        description: "Stylové topy, halenky a trička",
        sortOrder: 2,
      },
    }),
    prisma.category.create({
      data: {
        name: "Kalhoty & Sukně",
        slug: "kalhoty-sukne",
        description: "Pohodlné kalhoty a elegantní sukně",
        sortOrder: 3,
      },
    }),
    prisma.category.create({
      data: {
        name: "Bundy & Kabáty",
        slug: "bundy-kabaty",
        description: "Svrchní oblečení pro každé počasí",
        sortOrder: 4,
      },
    }),
    prisma.category.create({
      data: {
        name: "Doplňky",
        slug: "doplnky",
        description: "Šperky, kabelky, šátky a další doplňky",
        sortOrder: 5,
      },
    }),
  ]);

  console.log("Seed complete: 1 admin, 5 categories. Use import scripts for products.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
