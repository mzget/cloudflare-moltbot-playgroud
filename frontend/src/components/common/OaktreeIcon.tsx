import React from 'react';

interface OaktreeIconProps {
  size?: number;
  color?: string;
}

export default function OaktreeIcon({ size = 28, color = 'currentColor' }: OaktreeIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Majestic Oak Canopy - Layered Organic Crown */}
      <path 
        d="M32 6C24.5 6 18.2 10.6 16.3 17.2C10.4 18.1 6 23.2 6 29.4C6 35.8 10.9 41.1 17.2 41.7C18.8 43.2 21 44 23.5 44H40.5C43 44 45.2 43.2 46.8 41.7C53.1 41.1 58 35.8 58 29.4C58 23.2 53.6 18.1 47.7 17.2C45.8 10.6 39.5 6 32 6Z" 
        fill={color} 
        fillOpacity="0.22"
      />
      <path 
        d="M32 9C25.8 9 20.6 13 19 18.6C13.8 19.3 10 23.7 10 29C10 34.8 14.7 39.5 20.5 39.5H43.5C49.3 39.5 54 34.8 54 29C54 23.7 50.2 19.3 45 18.6C43.4 13 38.2 9 32 9ZM24 21C24.8 21 25.5 21.7 25.5 22.5C25.5 25.2 27.1 27.6 29.5 28.7V20C29.5 18.6 30.6 17.5 32 17.5C33.4 17.5 34.5 18.6 34.5 20V26.7C36.6 25.7 38.2 23.7 38.5 21.3C38.6 20.5 39.4 19.9 40.2 20C41 20.1 41.6 20.9 41.5 21.7C41 25.6 38.2 28.9 34.5 30.1V39.5H29.5V32.1C25.4 30.8 22.5 27 22.5 22.5C22.5 21.7 23.2 21 24 21Z" 
        fill={color} 
      />
      {/* Sturdy Oak Trunk & Grounded Roots */}
      <path 
        d="M28.5 38H35.5L37 49.5C37.4 52.3 39.6 54.6 42.5 55.2L45 55.8C45.8 56 46.3 56.8 46.1 57.6C45.9 58.4 45.2 58.9 44.4 58.8L38.5 57.8C35.8 57.3 33.5 55.8 32 53.6C30.5 55.8 28.2 57.3 25.5 57.8L19.6 58.8C18.8 58.9 18.1 58.4 17.9 57.6C17.7 56.8 18.2 56 19 55.8L21.5 55.2C24.4 54.6 26.6 52.3 27 49.5L28.5 38Z" 
        fill={color} 
      />
    </svg>
  );
}
