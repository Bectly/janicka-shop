-- Task #1049: Product.measurementsCm — free-text real measurements (multi-line) for second-hand pieces.
-- fitNote already exists from earlier migration; only the new column is added.
ALTER TABLE "Product" ADD COLUMN "measurementsCm" TEXT;
