'use client';
import type { RankedListing } from '@/lib/schemas';
import { money, MarketplaceBadge, DealScore } from './listings';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';

export function DealReviewModal({
  open, onOpenChange, listings, decisions, busyId, errors, onLike, onReject, onConnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: RankedListing[];
  decisions: Record<string, 'liked' | 'rejected'>;
  busyId: string | null;
  errors: Record<string, string>;
  onLike: (listing: RankedListing) => void;
  onReject: (listing: RankedListing) => void;
  onConnect: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Your top Facebook deals"
      description="Like the ones you want Haggleface to negotiate for you. Liking opens the seller DM and haggles on its own — no further approval needed."
    >
      <div className="deal-review-list">
        {listings.map((listing) => {
          const decision = decisions[listing.id];
          const error = errors[listing.id];
          return (
            <article key={listing.id} className={`deal-review-card ${decision ?? ''}`}>
              <img
                src={listing.imageUrls[0] || '/product.svg'}
                alt=""
                onError={(e) => { e.currentTarget.src = '/product.svg'; }}
              />
              <div className="deal-review-body">
                <MarketplaceBadge marketplace={listing.marketplace} />
                <strong>{listing.title}</strong>
                <div className="price-row"><span>{money(listing.price, listing.currency)}</span></div>
                <DealScore listing={listing} />
                {error && (
                  <p role="alert" className="error-state">
                    {error}
                    {/finish connecting/i.test(error) && (
                      <Button variant="outline" onClick={onConnect}>Connect Facebook</Button>
                    )}
                  </p>
                )}
              </div>
              <div className="deal-review-actions">
                {decision === 'liked' ? (
                  <span className="deal-review-status">Negotiating…</span>
                ) : decision === 'rejected' ? (
                  <span className="deal-review-status">Rejected</span>
                ) : (
                  <>
                    <Button disabled={busyId === listing.id} onClick={() => onLike(listing)}>
                      {busyId === listing.id ? 'Starting…' : 'Like'}
                    </Button>
                    <Button variant="ghost" onClick={() => onReject(listing)}>Reject</Button>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {!listings.length && <p>No Facebook listings yet — check back once the search finishes.</p>}
      </div>
    </Modal>
  );
}
