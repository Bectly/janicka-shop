import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://22f33409517699050d2eb775dab80565.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: "929954be3a7dad010ba14ad836c4855b", secretAccessKey: "44c867c98fd21bdde8db23f3f05f16bcea853145618878bd5429f779011d579d" },
});
const r = await r2.send(new ListObjectsV2Command({ Bucket: "janicka-shop-images", Prefix: "drivegen/" }));
for (const o of r.Contents || []) {
  console.log(`${(o.Size/1024/1024).toFixed(1).padStart(7)} MB  ${o.LastModified.toISOString().slice(0,10)}  ${o.Key}`);
}
