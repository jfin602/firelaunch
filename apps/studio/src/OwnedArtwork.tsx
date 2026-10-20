import React, { useEffect, useState } from 'react';
import type { CatalogItem, MediaAsset } from '@firelaunch/contracts';
import { readPrivateThumbnail } from './api.js';
import { safeArtwork } from './artwork-url.js';

export function ownedArtworkObject(item: CatalogItem | undefined, assets: MediaAsset[], projectId: string, accountId: string | null): string | null {
  if (!item || !accountId || item.projectId !== projectId || item.creatorAccountId !== accountId) return null;
  for (const id of [...item.mediaAssetIds].reverse()) {
    const asset = assets.find(value => value.id === id);
    if (asset?.kind === 'artwork' && asset.catalogItemId === item.id && asset.projectId === projectId &&
      asset.creatorAccountId === accountId && asset.location.type === 'private_object' &&
      asset.tvDisplayRights?.status !== 'revoked') return asset.location.objectId;
  }
  return null;
}

export function useOwnedArtwork(projectId: string, accountId: string | null, objectId: string | null, localFile?: File | null, itemId = ''): string | null {
  const scope = `${accountId ?? ''}:${projectId}:${itemId}:${objectId ?? ''}:${localFile?.name ?? ''}:${localFile?.size ?? ''}:${localFile?.lastModified ?? ''}`;
  const [image, setImage] = useState<{ scope: string; url: string } | null>(null);
  useEffect(() => {
    setImage(null);
    if (typeof URL.createObjectURL !== 'function') return;
    const controller = new AbortController();
    let created = '';
    const show = (blob: Blob) => {
      if (controller.signal.aborted) return;
      created = URL.createObjectURL(blob);
      setImage({ scope, url: created });
    };
    if (localFile && ['image/png', 'image/jpeg'].includes(localFile.type) && localFile.size > 0 && localFile.size <= 1_000_000) show(localFile);
    else if (accountId && objectId) void readPrivateThumbnail(projectId, objectId, controller.signal).then(show).catch(() => undefined);
    return () => { controller.abort(); if (created) URL.revokeObjectURL(created); };
  }, [scope, projectId, accountId, objectId, localFile]);
  return image?.scope === scope ? image.url : null;
}

export function OwnedArtwork({ item, assets, projectId, accountId, className, fallback, localFile, alt = '', imageClassName }: {
  item?: CatalogItem | undefined; assets: MediaAsset[]; projectId: string; accountId: string | null; className: string;
  fallback: React.ReactNode; localFile?: File | null; alt?: string; imageClassName?: string;
}) {
  const objectId = ownedArtworkObject(item, assets, projectId, accountId);
  const privateUrl = useOwnedArtwork(projectId, accountId, objectId, localFile, item?.id);
  const legacy = item && item.projectId === projectId && (!accountId || item.creatorAccountId === accountId) ? safeArtwork(item) : null;
  const [failed, setFailed] = useState('');
  const source = privateUrl && failed !== privateUrl ? privateUrl : legacy && failed !== legacy ? legacy : null;
  return <span className={className}>{source ? <img className={imageClassName} src={source} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(source)}/> : fallback}</span>;
}
