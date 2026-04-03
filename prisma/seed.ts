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

  // Create products — second hand: each item is unique (stock=1)
  const products = [
    // Šaty
    {
      name: "Letní květinové šaty Adéla",
      slug: "letni-kvetinove-saty-adela",
      description:
        "Vzdušné letní šaty s květinovým vzorem od Zary. Lehká látka s příjemným střihem pod kolena. Nošené 2×, stav jako nové.",
      price: 490,
      compareAt: 1590,
      sku: "SAT-001",
      categoryId: saty.id,
      brand: "Zara",
      condition: "excellent",
      sizes: JSON.stringify(["M"]),
      colors: JSON.stringify(["Růžová"]),
      images: JSON.stringify(["/images/products/saty-adela-1.jpg"]),
      stock: 1,
      featured: true,
    },
    {
      name: "Večerní šaty Eliška",
      slug: "vecerni-saty-eliska",
      description:
        "Elegantní černé večerní šaty s áčkovým střihem od H&M. Perfektní na slavnostní události. Nové s visačkou, nikdy nenošené.",
      price: 890,
      compareAt: 2490,
      sku: "SAT-002",
      categoryId: saty.id,
      brand: "H&M",
      condition: "new_with_tags",
      sizes: JSON.stringify(["S"]),
      colors: JSON.stringify(["Černá"]),
      images: JSON.stringify(["/images/products/saty-eliska-1.jpg"]),
      stock: 1,
      featured: true,
    },
    {
      name: "Košilové šaty Tereza",
      slug: "kosilove-saty-tereza",
      description:
        "Pohodlné košilové šaty s páskem. Příjemný bavlněný materiál od Reserved. Dobrý stav, drobné opotřebení na knoflíku.",
      price: 390,
      compareAt: 1690,
      sku: "SAT-003",
      categoryId: saty.id,
      brand: "Reserved",
      condition: "good",
      sizes: JSON.stringify(["L"]),
      colors: JSON.stringify(["Béžová"]),
      images: JSON.stringify(["/images/products/saty-tereza-1.jpg"]),
      stock: 1,
      featured: false,
    },
    {
      name: "Mini šaty Kristýna",
      slug: "mini-saty-kristyna",
      description:
        "Odvážné mini šaty s odhalenými rameny od & Other Stories. Ideální na letní párty. Výborný stav.",
      price: 690,
      compareAt: 1290,
      sku: "SAT-004",
      categoryId: saty.id,
      brand: "& Other Stories",
      condition: "excellent",
      sizes: JSON.stringify(["XS"]),
      colors: JSON.stringify(["Červená"]),
      images: JSON.stringify(["/images/products/saty-kristyna-1.jpg"]),
      stock: 1,
      featured: false,
    },

    // Topy & Halenky
    {
      name: "Saténová halenka Natálie",
      slug: "satenova-halenka-natalie",
      description:
        "Luxusní saténová halenka od Massimo Dutti. Perfektní k sukni i kalhotům. Výborný stav, bez vad.",
      price: 450,
      compareAt: 890,
      sku: "TOP-001",
      categoryId: topy.id,
      brand: "Massimo Dutti",
      condition: "excellent",
      sizes: JSON.stringify(["M"]),
      colors: JSON.stringify(["Champagne"]),
      images: JSON.stringify(["/images/products/halenka-natalie-1.jpg"]),
      stock: 1,
      featured: true,
    },
    {
      name: "Crop top Simona",
      slug: "crop-top-simona",
      description:
        "Trendy crop top z příjemné bavlny. Základní kousek do šatníku. Nový s visačkou.",
      price: 190,
      compareAt: 490,
      sku: "TOP-002",
      categoryId: topy.id,
      brand: "Stradivarius",
      condition: "new_with_tags",
      sizes: JSON.stringify(["S"]),
      colors: JSON.stringify(["Bílá"]),
      images: JSON.stringify(["/images/products/top-simona-1.jpg"]),
      stock: 1,
      featured: false,
    },
    {
      name: "Oversized tričko Daniela",
      slug: "oversized-tricko-daniela",
      description:
        "Pohodlné oversized tričko s potiskem od COS. Lehký a vzdušný materiál. Viditelné opotřebení na lemu.",
      price: 250,
      compareAt: 590,
      sku: "TOP-003",
      categoryId: topy.id,
      brand: "COS",
      condition: "visible_wear",
      sizes: JSON.stringify(["L/XL"]),
      colors: JSON.stringify(["Šedá"]),
      images: JSON.stringify(["/images/products/tricko-daniela-1.jpg"]),
      stock: 1,
      featured: false,
    },
    {
      name: "Romantická blůza Viktorie",
      slug: "romanticka-bluza-viktorie",
      description:
        "Romantická blůza s volánky od Mango. Jemný vzor, skvělá na rande. Výborný stav.",
      price: 490,
      compareAt: 1390,
      sku: "TOP-004",
      categoryId: topy.id,
      brand: "Mango",
      condition: "excellent",
      sizes: JSON.stringify(["S"]),
      colors: JSON.stringify(["Růžová"]),
      images: JSON.stringify(["/images/products/bluza-viktorie-1.jpg"]),
      stock: 1,
      featured: true,
    },

    // Kalhoty & Sukně
    {
      name: "Palazzo kalhoty Andrea",
      slug: "palazzo-kalhoty-andrea",
      description:
        "Elegantní wide-leg palazzo kalhoty s vysokým pasem od Zary. Pohodlné a stylové zároveň. Výborný stav.",
      price: 550,
      compareAt: 1490,
      sku: "KAL-001",
      categoryId: kalhoty.id,
      brand: "Zara",
      condition: "excellent",
      sizes: JSON.stringify(["M"]),
      colors: JSON.stringify(["Černá"]),
      images: JSON.stringify(["/images/products/kalhoty-andrea-1.jpg"]),
      stock: 1,
      featured: true,
    },
    {
      name: "Plisovaná sukně Markéta",
      slug: "plisovana-sukne-marketa",
      description:
        "Vzdušná plisovaná midi sukně od H&M. Nadčasový kousek. Dobrý stav, drobné zmačkání plisé.",
      price: 350,
      compareAt: 1190,
      sku: "KAL-002",
      categoryId: kalhoty.id,
      brand: "H&M",
      condition: "good",
      sizes: JSON.stringify(["S"]),
      colors: JSON.stringify(["Pudrová"]),
      images: JSON.stringify(["/images/products/sukne-marketa-1.jpg"]),
      stock: 1,
      featured: false,
    },
    {
      name: "Skinny džíny Barbora",
      slug: "skinny-dziny-barbora",
      description:
        "Klasické skinny džíny s vysokým pasem od Levi's. Strečový materiál. Výborný stav, bez známek opotřebení.",
      price: 690,
      compareAt: 1390,
      sku: "KAL-003",
      categoryId: kalhoty.id,
      brand: "Levi's",
      condition: "excellent",
      sizes: JSON.stringify(["M"]),
      colors: JSON.stringify(["Tmavě modrá"]),
      images: JSON.stringify(["/images/products/dziny-barbora-1.jpg"]),
      stock: 1,
      featured: false,
    },

    // Bundy & Kabáty
    {
      name: "Koženková bunda Lucie",
      slug: "kozenkova-bunda-lucie",
      description:
        "Stylová koženková bunda v motorkářském střihu od AllSaints. Must-have kousek. Nová s visačkou.",
      price: 1290,
      compareAt: 2790,
      sku: "BUN-001",
      categoryId: bundy.id,
      brand: "AllSaints",
      condition: "new_with_tags",
      sizes: JSON.stringify(["S"]),
      colors: JSON.stringify(["Černá"]),
      images: JSON.stringify(["/images/products/bunda-lucie-1.jpg"]),
      stock: 1,
      featured: true,
    },
    {
      name: "Oversize blazer Karolína",
      slug: "oversize-blazer-karolina",
      description:
        "Módní oversize blazer od Massimo Dutti. Ideální přes šaty i k džínám. Výborný stav.",
      price: 890,
      compareAt: 1890,
      sku: "BUN-002",
      categoryId: bundy.id,
      brand: "Massimo Dutti",
      condition: "excellent",
      sizes: JSON.stringify(["M"]),
      colors: JSON.stringify(["Béžová"]),
      images: JSON.stringify(["/images/products/blazer-karolina-1.jpg"]),
      stock: 1,
      featured: false,
    },
    {
      name: "Prošívaná vesta Hana",
      slug: "prosivana-vesta-hana",
      description:
        "Lehká prošívaná vesta od Mango na přechodné období. Praktická a stylová vrstva navíc. Dobrý stav.",
      price: 490,
      compareAt: 1590,
      sku: "BUN-003",
      categoryId: bundy.id,
      brand: "Mango",
      condition: "good",
      sizes: JSON.stringify(["L"]),
      colors: JSON.stringify(["Khaki"]),
      images: JSON.stringify(["/images/products/vesta-hana-1.jpg"]),
      stock: 1,
      featured: false,
    },

    // Doplňky
    {
      name: "Kožená kabelka Sofie",
      slug: "kozena-kabelka-sofie",
      description:
        "Elegantní kožená kabelka střední velikosti od Coach. Praktické vnitřní kapsy a odnímatelný popruh. Výborný stav.",
      price: 1490,
      compareAt: 1990,
      sku: "DOP-001",
      categoryId: doplnky.id,
      brand: "Coach",
      condition: "excellent",
      sizes: JSON.stringify(["Uni"]),
      colors: JSON.stringify(["Hnědá"]),
      images: JSON.stringify(["/images/products/kabelka-sofie-1.jpg"]),
      stock: 1,
      featured: true,
    },
    {
      name: "Hedvábný šátek Petra",
      slug: "hedvabny-satek-petra",
      description:
        "Jemný hedvábný šátek s originálním vzorem. Nový, nikdy nenošený. Stále v originálním balení.",
      price: 390,
      compareAt: 690,
      sku: "DOP-002",
      categoryId: doplnky.id,
      brand: "Furla",
      condition: "new_with_tags",
      sizes: JSON.stringify(["Uni"]),
      colors: JSON.stringify(["Vícebarevný"]),
      images: JSON.stringify(["/images/products/satek-petra-1.jpg"]),
      stock: 1,
      featured: false,
    },
    {
      name: "Sada náušnic Aneta",
      slug: "sada-nausnic-aneta",
      description:
        "Set 3 párů minimalistických náušnic. Pozlacený kov, vhodné pro alergiky. Nové, nerozbalené.",
      price: 290,
      compareAt: 490,
      sku: "DOP-003",
      categoryId: doplnky.id,
      brand: "Pandora",
      condition: "new_with_tags",
      sizes: JSON.stringify(["Uni"]),
      colors: JSON.stringify(["Zlatá"]),
      images: JSON.stringify(["/images/products/nausnice-aneta-1.jpg"]),
      stock: 1,
      featured: false,
    },
  ];

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log("Seed complete: 1 admin, 5 categories, 18 products (second hand)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
