import type { SocialmediaTargetAsset } from "@/lib/socialmedia/types";

export function stripTargetAssetStorageReferences(targetAssets: SocialmediaTargetAsset[]): SocialmediaTargetAsset[] {
  return targetAssets
    .map((asset) => ({
      assetId: asset.assetId,
      bucket: "generated-assets" as const,
      imageIndex: asset.imageIndex,
      parentJobId: asset.parentJobId
    }))
    .filter((asset) => asset.assetId);
}
