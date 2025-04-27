// src/components/LocationSelector.tsx
'use client';

import React from 'react';

// Define simplified props (only needs disabled state)
interface LocationSelectorProps {
  disabled: boolean;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({ disabled }) => {
  return (
    <div className={`p-4 rounded-xl shadow-lg backdrop-blur-sm border border-white/10 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${'bg-black/10'}`}> {/* Example dark theme card style */}
      {/* Apply Section Heading Style */}
      <h2 className="text-xl font-semibold mb-3 text-inherit opacity-90">Location</h2>
      {/* Apply Body Text Style */}
      <p className="text-sm opacity-80">
        {disabled ? 'Getting your location...' : 'Using your current location.'}
      </p>
    </div>
  );
};
export default LocationSelector;