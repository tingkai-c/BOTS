import type { Listing } from '@/lib/schemas';

type Inspection = Pick<Listing, 'description' | 'inspectionStatus' | 'inspectionError' | 'inspectedAt' | 'availability'>;

export function inspectionSummary(listing: Inspection): string | undefined {
  const description = listing.description?.trim();
  if (listing.inspectionStatus === 'complete' && !description) {
    return listing.availability === 'sold'
      ? 'Listing sold · description unavailable'
      : 'Incomplete · the previous inspection did not save a description. Retry inspection.';
  }
  if (listing.inspectionStatus === 'failed') {
    return `Incomplete · ${listing.inspectionError || 'Details could not be read. Retry inspection.'}`;
  }
  if (listing.inspectionStatus === 'pending') return 'Not inspected yet';
  if (listing.inspectionStatus === 'complete') return 'Description extracted';
}

export function needsDetailInspection(listing: Inspection): boolean {
  // Repair old title-only "complete" records on the next discovery pass.
  // Failed attempts retain inspectedAt, so they do not retry indefinitely.
  return !listing.inspectedAt || (
    listing.inspectionStatus === 'complete' &&
    !listing.description?.trim() &&
    listing.availability !== 'sold'
  );
}
