import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://22f33409517699050d2eb775dab80565.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: "929954be3a7dad010ba14ad836c4855b", secretAccessKey: "44c867c98fd21bdde8db23f3f05f16bcea853145618878bd5429f779011d579d" },
});
let totalSize = 0, totalCount = 0;
const byPrefix = {};
let continuationToken;
do {
  const r = await r2.send(new ListObjectsV2Command({ Bucket: "janicka-shop-images", ContinuationToken: continuationToken, MaxKeys: 1000 }));
  for (const o of r.Contents || []) {
    totalCount++; totalSize += o.Size || 0;
    const prefix = o.Key.split("/")[0] || "_root";
    byPrefix[prefix] = byPrefix[prefix] || { count: 0, size: 0 };
    byPrefix[prefix].count++; byPrefix[prefix].size += o.Size || 0;
  }
  continuationToken = r.NextContinuationToken;
} while (continuationToken);
console.log(`Total: ${totalCount} objects, ${(totalSize/1024/1024).toFixed(1)} MB`);
console.log(`Free tier limit: 10000 MB (10 GB)`);
console.log(`---By prefix---`);
const entries = Object.entries(byPrefix).sort((a,b) => b[1].size - a[1].size);
for (const [k, v] of entries) {
  console.log(`${k.padEnd(30)} ${String(v.count).padStart(6)} files  ${(v.size/1024/1024).toFixed(1).padStart(8)} MB`);
}
