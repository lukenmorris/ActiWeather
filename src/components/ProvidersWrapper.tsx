// src/components/ProvidersWrapper.tsx
'use client';

import React from 'react';
import { UserPreferencesProvider } from '@/context/UserPreferencesContext';

export default function ProvidersWrapper({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <UserPreferencesProvider>
      {children}
    </UserPreferencesProvider>
  );
}