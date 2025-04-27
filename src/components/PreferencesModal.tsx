// src/components/PreferencesModal.tsx
'use client';

import React from 'react';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null; // Don't render anything if not open
  }

  // Basic modal structure using Tailwind CSS
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
      onClick={onClose} // Close on overlay click
    >
      <div
        className="bg-white p-5 md:p-6 rounded-lg shadow-xl w-full max-w-lg relative max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal content
      >
        <h2 className="text-xl font-semibold mb-4 text-slate-700 border-b pb-2">Your Preferences</h2>

        {/* Placeholder for actual preference controls */}
        <div className="min-h-[200px] text-gray-600">
          <p>Preference settings will go here later.</p>
          {/* We'll add the like/dislike controls here in a future step */}
        </div>

        <div className="mt-6 flex justify-end border-t pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreferencesModal;