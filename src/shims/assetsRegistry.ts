export type AssetDestPathResolver = "android" | "generic";

export function registerAsset(_asset: { name: string; type: string; hash: string; httpServerLocation: string; scales: number[]; width?: number; height?: number }) {
  return 0;
}

export function getAssetByID(_assetId: number) {
  return null;
}

export function getAssetUsingResolver(_assetId: number, _resolver?: AssetDestPathResolver) {
  return null;
}
