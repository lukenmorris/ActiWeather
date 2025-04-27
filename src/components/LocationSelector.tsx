// src/components/LocationSelector.tsx
'use client';

import React from 'react';

// Define simplified props (only needs disabled state)
interface LocationSelectorProps {
  disabled: boolean;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ disabled }) => {
  // Basic placeholder content, showing it uses current location
  return (
    <div className={`p-4 border border-gray-200 rounded-lg shadow-md bg-white/80 backdrop-blur-sm ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <h2 className="text-xl font-semibold mb-3 text-slate-600">Location</h2>
      <p className="text-gray-600 text-sm">
        {disabled ? 'Getting your location...' : 'Using your current location.'}
      </p>
       {/* Manual search input and radius slider removed */}
       {/* "Use My Current Location" button removed as it's the only mode now */}
    </div>
  );
};

export default LocationSelector;