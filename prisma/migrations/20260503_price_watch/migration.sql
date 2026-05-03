-- Task #980: PriceWatch model — price-drop notifications opt-in per product.
CREATE TABLE "PriceWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "userId" TEXT,
    "unsubToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PriceWatch_unsubToken_key" ON "PriceWatch"("unsubToken");
CREATE UNIQUE INDEX "PriceWatch_email_productId_key" ON "PriceWatch"("email", "productId");
CREATE INDEX "PriceWatch_productId_idx" ON "PriceWatch"("productId");
CREATE INDEX "PriceWatch_email_idx" ON "PriceWatch"("email");
