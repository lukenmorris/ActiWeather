// src/components/PreferencesIndicator.tsx
'use client';

import React from 'react';
import { useUserPreferences } from '@/context/UserPreferencesContext';
import { getPreferenceSummary } from '@/lib/personalizedScoring';
import {
  Settings, Filter, Heart, Ban, DollarSign, MapPin,
  Star, Users, Baby, Accessibility, Clock, Sparkles,
  X, ChevronRight
} from 'lucide-react';

interface PreferencesIndicatorProps {
  isDarkTheme?: boolean;
  onOpenPreferences: () => void;
}

export default function PreferencesIndicator({ 
  isDarkTheme = false, 
  onOpenPreferences 
}: PreferencesIndicatorProps) {
  const { preferences, setActiveMood, resetPreferences } = useUserPreferences();
  const summary = getPreferenceSummary(preferences);
  
  // Don't show if no preferences are active
  const hasActivePreferences = 
    preferences.activityTypes.activeMood ||
    preferences.activityTypes.favorites.length > 0 ||
    preferences.activityTypes.blacklist.length > 0 ||
    preferences.filters.maxRadius !== 5 ||
    preferences.filters.maxPriceLevel < 4 ||
    preferences.filters.minRating > 0 ||
    preferences.filters.familyFriendly ||
    preferences.filters.accessibilityRequired;
  
  if (!hasActivePreferences) return null;
  
  const bgClass = isDarkTheme 
    ? 'bg-gray-900/90 text-white' 
    : 'bg-white/90 text-gray-900';
  
  const borderClass = isDarkTheme
    ? 'border-gray-700'
    : 'border-gray-200';
  
  return (
    <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-30 ${bgClass} backdrop-blur-lg rounded-2xl shadow-2xl border ${borderClass} animate-slide-up`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Filter className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm">Active Filters</span>
        </div>
        <button
          onClick={onOpenPreferences}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
      
      {/* Active preferences */}
      <div className="p-4 space-y-3">
        {/* Mood */}
        {preferences.activityTypes.activeMood && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium capitalize">
                {preferences.activityTypes.activeMood} Mode
              </span>
            </div>
            <button
              onClick={() => setActiveMood(null)}
              className="p-1 rounded hover:bg-purple-500/20 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        
        {/* Favorites */}
        {preferences.activityTypes.favorites.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <Heart className="w-4 h-4 text-green-500 fill-current" />
            <span className="text-sm">
              {preferences.activityTypes.favorites.length} favorite{preferences.activityTypes.favorites.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        
        {/* Blacklist */}
        {preferences.activityTypes.blacklist.length > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <Ban className="w-4 h-4 text-red-500" />
            <span className="text-sm">
              {preferences.activityTypes.blacklist.length} hidden
            </span>
          </div>
        )}
        
        {/* Budget */}
        {preferences.filters.maxPriceLevel < 4 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="text-sm">
              Max {'$'.repeat(preferences.filters.maxPriceLevel + 1)}
            </span>
          </div>
        )}
        
        {/* Distance */}
        {preferences.filters.maxRadius !== 5 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <MapPin className="w-4 h-4 text-blue-500" />
            <span className="text-sm">
              {preferences.filters.maxRadius}km max
            </span>
          </div>
        )}
        
        {/* Rating */}
        {preferences.filters.minRating > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-sm">
              {preferences.filters.minRating}+ stars
            </span>
          </div>
        )}
        
        {/* Special filters */}
        <div className="flex flex-wrap gap-2">
          {preferences.filters.familyFriendly && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-pink-500/10 border border-pink-500/20">
              <Baby className="w-3 h-3 text-pink-500" />
              <span className="text-xs">Family</span>
            </div>
          )}
          {preferences.filters.accessibilityRequired && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <Accessibility className="w-3 h-3 text-indigo-500" />
              <span className="text-xs">Accessible</span>
            </div>
          )}
          {preferences.filters.openNowOnly && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <Clock className="w-3 h-3 text-green-500" />
              <span className="text-xs">Open now</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-between p-3 border-t border-white/10">
        <button
          onClick={() => {
            if (confirm('Reset all preferences to defaults?')) {
              resetPreferences();
            }
          }}
          className="text-xs text-red-500 hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
        <button
          onClick={onOpenPreferences}
          className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-400 transition-colors font-medium"
        >
          Customize
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      
      {/* CSS for slide-up animation */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}