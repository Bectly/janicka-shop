import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.orderItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.admin.deleteMany();

  // Create admin
  const adminPassword = await hash("admin123", 12);
  await prisma.admin.create({
    data: {
      email: "janicka@shop.cz",
      password: adminPassword,
      name: "Janička",
      role: "admin",
    },
  });

  // Create categories
  const categories = await Promise.all([
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

  const [saty, topy, kalhoty, bundy, doplnky] = categories;

  // Create products
  const products = [
    // Šaty
    {
      name: "Letní květinové šaty Adéla",
      slug: "letni-kvetinove-saty-adela",
      description:
        "Vzdušné letní šaty s květinovým vzorem. Ideální na teplé dny, lehká látka s příjemným střihem pod kolena.",
      price: 1290,
      compareAt: 1590,
      sku: "SAT-001",
      categoryId: saty.id,
      sizes: JSON.stringify(["XS", "S", "M", "L", "XL"]),
      colors: JSON.stringify(["Růžová", "Modrá", "Bílá"]),
      images: JSON.stringify(["/images/products/saty-adela-1.jpg"]),
      stock: 25,
      featured: true,
    },
    {
      name: "Večerní šaty Eliška",
      slug: "vecerni-saty-eliska",
      description:
        "Elegantní černé večerní šaty s áčkovým střihem. Perfektní na slavnostní události a večírky.",
      price: 2490,
      sku: "SAT-002",
      categoryId: saty.id,
      sizes: JSON.stringify(["XS", "S", "M", "L"]),
      colors: JSON.stringify(["Černá", "Bordó"]),
      images: JSON.stringify(["/images/products/saty-eliska-1.jpg"]),
      stock: 15,
      featured: true,
    },
    {
      name: "Košilové šaty Tereza",
      slug: "kosilove-saty-tereza",
      description:
        "Pohodlné košilové šaty s páskem. Skvělé do práce i na běžné nošení. Příjemný bavlněný materiál.",
      price: 1690,
      sku: "SAT-003",
      categoryId: saty.id,
      sizes: JSON.stringify(["S", "M", "L", "XL"]),
      colors: JSON.stringify(["Béžová", "Khaki", "Bílá"]),
      images: JSON.stringify(["/images/products/saty-tereza-1.jpg"]),
      stock: 20,
      featured: false,
    },
    {
      name: "Mini šaty Kristýna",
      slug: "mini-saty-kristyna",
      description:
        "Odvážné mini šaty s odhalenými rameny. Ideální na letní párty a festivaly.",
      price: 990,
      compareAt: 1290,
      sku: "SAT-004",
      categoryId: saty.id,
      sizes: JSON.stringify(["XS", "S", "M", "L"]),
      colors: JSON.stringify(["Červená", "Černá", "Bílá"]),
      images: JSON.stringify(["/images/products/saty-kristyna-1.jpg"]),
      stock: 30,
      featured: false,
    },

    // Topy & Halenky
    {
      name: "Saténová halenka Natálie",
      slug: "satenova-halenka-natalie",
      description:
        "Luxusní saténová halenka s elegantním střihem. Perfektní k sukni i kalhotům.",
      price: 890,
      sku: "TOP-001",
      categoryId: topy.id,
      sizes: JSON.stringify(["XS", "S", "M", "L", "XL"]),
      colors: JSON.stringify(["Champagne", "Černá", "Bílá"]),
      images: JSON.stringify(["/images/products/halenka-natalie-1.jpg"]),
      stock: 35,
      featured: true,
    },
    {
      name: "Crop top Simona",
      slug: "crop-top-simona",
      description:
        "Trendy crop top z příjemné bavlny. Základní kousek do šatníku každé moderní ženy.",
      price: 490,
      sku: "TOP-002",
      categoryId: topy.id,
      sizes: JSON.stringify(["XS", "S", "M", "L"]),
      colors: JSON.stringify(["Bílá", "Černá", "Růžová", "Lila"]),
      images: JSON.stringify(["/images/products/top-simona-1.jpg"]),
      stock: 50,
      featured: false,
    },
    {
      name: "Oversized tričko Daniela",
      slug: "oversized-tricko-daniela",
      description:
        "Pohodlné oversized tričko s potiskem. Lehký a vzdušný materiál pro volnočasový styl.",
      price: 590,
      sku: "TOP-003",
      categoryId: topy.id,
      sizes: JSON.stringify(["S/M", "L/XL"]),
      colors: JSON.stringify(["Bílá", "Šedá", "Béžová"]),
      images: JSON.stringify(["/images/products/tricko-daniela-1.jpg"]),
      stock: 40,
      featured: false,
    },
    {
      name: "Romantická blůza Viktorie",
      slug: "romanticka-bluza-viktorie",
      description:
        "Romantická blůza s volánky a jemným vzorem. Skvělá volba pro rande nebo oběd s kamarádkami.",
      price: 1090,
      compareAt: 1390,
      sku: "TOP-004",
      categoryId: topy.id,
      sizes: JSON.stringify(["XS", "S", "M", "L"]),
      colors: JSON.stringify(["Růžová", "Lila", "Bílá"]),
      images: JSON.stringify(["/images/products/bluza-viktorie-1.jpg"]),
      stock: 22,
      featured: true,
    },

    // Kalhoty & Sukně
    {
      name: "Palazzo kalhoty Andrea",
      slug: "palazzo-kalhoty-andrea",
      description:
        "Elegantní wide-leg palazzo kalhoty s vysokým pasem. Pohodlné a stylové zároveň.",
      price: 1490,
      sku: "KAL-001",
      categoryId: kalhoty.id,
      sizes: JSON.stringify(["XS", "S", "M", "L", "XL"]),
      colors: JSON.stringify(["Černá", "Béžová", "Námořnická"]),
      images: JSON.stringify(["/images/products/kalhoty-andrea-1.jpg"]),
      stock: 18,
      featured: true,
    },
    {
      name: "Plisovaná sukně Markéta",
      slug: "plisovana-sukne-marketa",
      description:
        "Vzdušná plisovaná midi sukně. Nadčasový kousek, který se hodí k blůze i svetru.",
      price: 1190,
      sku: "KAL-002",
      categoryId: kalhoty.id,
      sizes: JSON.stringify(["XS", "S", "M", "L"]),
      colors: JSON.stringify(["Pudrová", "Černá", "Šedá"]),
      images: JSON.stringify(["/images/products/sukne-marketa-1.jpg"]),
      stock: 20,
      featured: false,
    },
    {
      name: "Skinny džíny Barbora",
      slug: "skinny-dziny-barbora",
      description:
        "Klasické skinny džíny s vysokým pasem. Strečový materiál pro maximální pohodlí.",
      price: 1390,
      sku: "KAL-003",
      categoryId: kalhoty.id,
      sizes: JSON.stringify(["XS", "S", "M", "L", "XL"]),
      colors: JSON.stringify(["Světle modrá", "Tmavě modrá", "Černá"]),
      images: JSON.stringify(["/images/products/dziny-barbora-1.jpg"]),
      stock: 28,
      featured: false,
    },

    // Bundy & Kabáty
    {
      name: "Koženková bunda Lucie",
      slug: "kozenkova-bunda-lucie",
      description:
        "Stylová koženková bunda v motorkářském střihu. Must-have kousek do jarního šatníku.",
      price: 2290,
      compareAt: 2790,
      sku: "BUN-001",
      categoryId: bundy.id,
      sizes: JSON.stringify(["XS", "S", "M", "L"]),
      colors: JSON.stringify(["Černá", "Hnědá"]),
      images: JSON.stringify(["/images/products/bunda-lucie-1.jpg"]),
      stock: 12,
      featured: true,
    },
    {
      name: "Oversize blazer Karolína",
      slug: "oversize-blazer-karolina",
      description:
        "Módní oversize blazer v neutrálních tónech. Ideální přes šaty i k džínám.",
      price: 1890,
      sku: "BUN-002",
      categoryId: bundy.id,
      sizes: JSON.stringify(["S", "M", "L"]),
      colors: JSON.stringify(["Béžová", "Černá", "Šedá"]),
      images: JSON.stringify(["/images/products/blazer-karolina-1.jpg"]),
      stock: 15,
      featured: false,
    },
    {
      name: "Prošívaná vesta Hana",
      slug: "prosivana-vesta-hana",
      description:
        "Lehká prošívaná vesta na přechodné období. Praktická a stylová vrstva navíc.",
      price: 1590,
      sku: "BUN-003",
      categoryId: bundy.id,
      sizes: JSON.stringify(["XS", "S", "M", "L", "XL"]),
      colors: JSON.stringify(["Černá", "Khaki", "Béžová"]),
      images: JSON.stringify(["/images/products/vesta-hana-1.jpg"]),
      stock: 20,
      featured: false,
    },

    // Doplňky
    {
      name: "Kožená kabelka Sofie",
      slug: "kozena-kabelka-sofie",
      description:
        "Elegantní kožená kabelka střední velikosti. Praktické vnitřní kapsy a odnímatelný popruh.",
      price: 1990,
      sku: "DOP-001",
      categoryId: doplnky.id,
      sizes: JSON.stringify(["Uni"]),
      colors: JSON.stringify(["Černá", "Hnědá", "Béžová"]),
      images: JSON.stringify(["/images/products/kabelka-sofie-1.jpg"]),
      stock: 10,
      featured: true,
    },
    {
      name: "Hedvábný šátek Petra",
      slug: "hedvabny-satek-petra",
      description:
        "Jemný hedvábný šátek s originálním vzorem. Lze nosit kolem krku, ve vlasech i jako doplněk kabelky.",
      price: 690,
      sku: "DOP-002",
      categoryId: doplnky.id,
      sizes: JSON.stringify(["Uni"]),
      colors: JSON.stringify(["Vícebarevný", "Růžový", "Modrý"]),
      images: JSON.stringify(["/images/products/satek-petra-1.jpg"]),
      stock: 25,
      featured: false,
    },
    {
      name: "Sada náušnic Aneta",
      slug: "sada-nausnic-aneta",
      description:
        "Set 3 párů minimalistických náušnic. Pozlacený kov, vhodné pro alergiky.",
      price: 490,
      sku: "DOP-003",
      categoryId: doplnky.id,
      sizes: JSON.stringify(["Uni"]),
      colors: JSON.stringify(["Zlatá", "Stříbrná"]),
      images: JSON.stringify(["/images/products/nausnice-aneta-1.jpg"]),
      stock: 40,
      featured: false,
    },
  ];

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log("Seed complete: 1 admin, 5 categories, 18 products");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
