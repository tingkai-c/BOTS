"use client";
import React from "react";
import type { Marketplace } from "@/lib/schemas";

export function FacebookLogo({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`platform-logo-box green-filter ${className}`}
      style={{ width: size, height: size }}
      title="Facebook Marketplace"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="platform-logo-svg"
      >
        <rect width="24" height="24" rx="5" fill="#1877F2" />
        <path
          d="M16.5 12.2H14.1V21H10.5V12.2H8.8V9.3H10.5V7.2C10.5 5.3 11.6 3.8 14.3 3.8H16.5V6.7H15C13.9 6.7 14.1 7.2 14.1 8V9.3H16.4L16.5 12.2Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

export function EbayLogo({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`platform-logo-box green-filter ebay-logo-box ${className}`}
      style={{ width: size, height: size }}
      title="eBay"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="platform-logo-svg"
      >
        <rect
          width="23"
          height="23"
          x="0.5"
          y="0.5"
          rx="5"
          fill="#FFFFFF"
          stroke="#E2E8F0"
          strokeWidth="1"
        />
        <g transform="translate(1, 0)">
          {/* e */}
          <path
            d="M6.2 11.2C6 9.8 4.9 8.8 3.4 8.8C1.8 8.8 0.7 10 0.7 11.9C0.7 13.8 1.9 15 3.5 15C4.9 15 5.9 14.2 6.2 13.1H4.8C4.5 13.7 4.1 14 3.5 14C2.6 14 2 13.3 2 12.2H6.3V11.2ZM2 11.1C2.1 10.3 2.6 9.8 3.4 9.8C4.1 9.8 4.7 10.3 4.8 11.1H2Z"
            fill="#E53238"
          />
          {/* b */}
          <path
            d="M7 6H8.3V9.5C8.8 8.9 9.5 8.6 10.3 8.6C11.7 8.6 12.7 9.8 12.7 11.8C12.7 13.8 11.7 15 10.3 15C9.5 15 8.8 14.7 8.3 14.1V15H7V6ZM10 9.7C9.2 9.7 8.5 10.5 8.5 11.8C8.5 13.1 9.2 13.9 10 13.9C10.8 13.9 11.4 13.1 11.4 11.8C11.4 10.5 10.8 9.7 10 9.7Z"
            fill="#0064D2"
          />
          {/* a */}
          <path
            d="M16.5 15H15.3V14.3C14.9 14.8 14.2 15.1 13.4 15.1C12.3 15.1 11.5 14.4 11.5 13.3C11.5 11.9 12.5 11.3 13.8 11.2L15.3 11.1V10.7C15.3 10 14.8 9.6 14 9.6C13.3 9.6 12.8 9.9 12.6 10.4L11.6 10.1C11.9 9.1 12.8 8.6 14 8.6C15.5 8.6 16.5 9.5 16.5 10.9V15ZM15.3 12.1L14.1 12.2C13.3 12.3 12.9 12.7 12.9 13.2C12.9 13.8 13.4 14.1 14 14.1C14.8 14.1 15.3 13.6 15.3 12.8V12.1Z"
            fill="#F5AF02"
          />
          {/* y */}
          <path
            d="M18.4 13.9L20.1 8.8H21.5L19.2 15.2C18.5 16.7 17.8 17.2 16.6 17.2H15.9V16H16.3C17.1 16 17.5 15.6 17.9 14.7L16.8 8.8H18.2L19.1 13.9H18.4Z"
            fill="#86B817"
          />
        </g>
      </svg>
    </div>
  );
}

export function KijijiLogo({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`platform-logo-box green-filter kijiji-logo-box ${className}`}
      style={{ width: size, height: size }}
      title="Kijiji"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="platform-logo-svg"
      >
        <rect width="24" height="24" rx="5" fill="#49247A" />
        <g transform="translate(4, 3.5)">
          {/* Vertical stem */}
          <path
            d="M3.2 1.6C3.2 0.7 2.5 0 1.6 0C0.7 0 0 0.7 0 1.6V14.4C0 15.3 0.7 16 1.6 16C2.5 16 3.2 15.3 3.2 14.4V1.6Z"
            fill="white"
          />
          {/* Upper leaf in official Kijiji green */}
          <path
            d="M10.2 4.2C9.8 3.7 9 3.5 8.4 4L3.6 7.4V11.4L9 6.2C9.6 5.6 9.7 4.8 10.2 4.2Z"
            fill="#86C63B"
          />
          {/* Lower leaf in white */}
          <path
            d="M4.2 10.5L9.8 15C10.4 15.5 11.2 15.3 11.6 14.7C12.1 14.1 11.9 13.3 11.3 12.8L6.4 8.8L4.2 10.5Z"
            fill="white"
          />
        </g>
      </svg>
    </div>
  );
}

export function PlatformLogo({
  market,
  size = 20,
  className = "",
}: {
  market: Marketplace;
  size?: number;
  className?: string;
}) {
  switch (market) {
    case "facebook":
      return <FacebookLogo size={size} className={className} />;
    case "ebay":
      return <EbayLogo size={size} className={className} />;
    case "kijiji":
      return <KijijiLogo size={size} className={className} />;
    default:
      return null;
  }
}
