import { isLikelyImageFile } from "@/lib/socialmedia/client-upload";

type ComposerFileTransfer = Pick<DataTransfer, "files" | "items" | "types">;

export function hasFileTransfer(transfer: Pick<ComposerFileTransfer, "types">): boolean {
  return Array.from(transfer.types).includes("Files");
}

export function collectImageFilesFromTransfer(
  transfer: Pick<ComposerFileTransfer, "files" | "items">
): File[] {
  const itemFiles = Array.from(transfer.items)
    .filter((item) => item.kind === "file")
    .flatMap((item) => {
      const file = item.getAsFile();
      return file ? [file] : [];
    });
  const files = itemFiles.length ? itemFiles : Array.from(transfer.files);
  return files.filter(isLikelyImageFile);
}

export function reserveComposerUploadRequestIds(
  activeRequestIds: Set<number>,
  candidateRequestIds: readonly number[],
  maxUploads: number
): number[] {
  const capacity = Number.isFinite(maxUploads) && maxUploads > 0
    ? Math.floor(maxUploads)
    : 0;
  let remainingCapacity = Math.max(0, capacity - activeRequestIds.size);
  const reservedRequestIds: number[] = [];

  for (const requestId of candidateRequestIds) {
    if (remainingCapacity === 0) {
      break;
    }
    if (activeRequestIds.has(requestId)) {
      continue;
    }

    activeRequestIds.add(requestId);
    reservedRequestIds.push(requestId);
    remainingCapacity -= 1;
  }

  return reservedRequestIds;
}

export function enqueueReservedComposerUploads<T extends { requestId: number }>(
  activeRequestIds: Set<number>,
  candidates: readonly T[],
  maxUploads: number,
  onAccepted: (accepted: readonly T[]) => void
): T[] {
  const candidatesByRequestId = new Map<number, T>();
  for (const candidate of candidates) {
    if (!candidatesByRequestId.has(candidate.requestId)) {
      candidatesByRequestId.set(candidate.requestId, candidate);
    }
  }

  const reservedRequestIds = reserveComposerUploadRequestIds(
    activeRequestIds,
    candidates.map((candidate) => candidate.requestId),
    maxUploads
  );
  const accepted = reservedRequestIds.flatMap((requestId) => {
    const candidate = candidatesByRequestId.get(requestId);
    return candidate ? [candidate] : [];
  });

  if (accepted.length > 0) {
    onAccepted(accepted);
  }

  return accepted;
}

export function resolveComposerSubmissionSourceAssets<T>(params: {
  supportsContinuation: boolean;
  uploadedSourceAssets: readonly T[];
  continuationSourceAssets: readonly T[];
}): {
  availableSourceAssets: T[];
  usesContinuationSourceAssets: boolean;
} {
  const usesContinuationSourceAssets = params.supportsContinuation
    && params.uploadedSourceAssets.length === 0
    && params.continuationSourceAssets.length > 0;

  return {
    availableSourceAssets: [
      ...(usesContinuationSourceAssets
        ? params.continuationSourceAssets
        : params.uploadedSourceAssets)
    ],
    usesContinuationSourceAssets
  };
}
