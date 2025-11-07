// src/components/FilterSummary.tsx
'use client';

import React from 'react';
import { Filter, X, MapPin, Star, DollarSign, Clock, Heart, Ban, Sparkles } from 'lucide-react';
import type { FilterStats } from '@/lib/applyPreferences';
import { useUserPreferences } from '@/context/UserPreferencesContext';

interface FilterSummaryProps {
  stats: FilterStats;
  isDarkTheme?: boolean;
}

export default function FilterSummary({ stats, isDarkTheme = false }: FilterSummaryProps) {
  const { preferences } = useUserPreferences();

  const hasActiveFilters =
    preferences.activityTypes.activeMood ||
    preferences.activityTypes.favorites.length > 0 ||
    preferences.activityTypes.blacklist.length > 0 ||
    preferences.filters.maxRadius !== 5 ||
    preferences.filters.maxPriceLevel < 4 ||
    preferences.filters.minRating > 0 ||
    preferences.filters.openNowOnly ||
    preferences.filters.familyFriendly ||
    preferences.filters.accessibilityRequired;

  if (!hasActiveFilters) {
    return null;
  }

  const bgClass = isDarkTheme
    ? 'bg-gray-900/90 text-white'
    : 'bg-white/90 text-gray-900';

  const borderClass = isDarkTheme
    ? 'border-gray-700'
    : 'border-gray-200';

  return (
    <div className={`${bgClass} backdrop-blur-lg rounded-2xl p-6 border ${borderClass} shadow-xl mb-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Active Filters</h3>
            <p className="text-sm opacity-60">
              {stats.passed} of {stats.total} places shown
              {stats.filtered > 0 && ` · ${stats.filtered} hidden`}
            </p>
          </div>
        </div>
      </div>

      {/* Active Filter Tags */}
      <div className="flex flex-wrap gap-2">
        {/* Mood */}
        {preferences.activityTypes.activeMood && (
          <FilterTag
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label={`${capitalize(preferences.activityTypes.activeMood)} mode`}
            color="purple"
          />
        )}

        {/* Favorites */}
        {preferences.activityTypes.favorites.length > 0 && (
          <FilterTag
            icon={<Heart className="w-3.5 h-3.5 fill-current" />}
            label={`${preferences.activityTypes.favorites.length} favorites`}
            color="green"
          />
        )}

        {/* Blacklist */}
        {preferences.activityTypes.blacklist.length > 0 && (
          <FilterTag
            icon={<Ban className="w-3.5 h-3.5" />}
            label={`${preferences.activityTypes.blacklist.length} hidden`}
            color="red"
          />
        )}

        {/* Distance */}
        {preferences.filters.maxRadius !== 5 && (
          <FilterTag
            icon={<MapPin className="w-3.5 h-3.5" />}
            label={`${preferences.filters.maxRadius}km max`}
            color="blue"
          />
        )}

        {/* Rating */}
        {preferences.filters.minRating > 0 && (
          <FilterTag
            icon={<Star className="w-3.5 h-3.5" />}
            label={`${preferences.filters.minRating}+ stars`}
            color="yellow"
          />
        )}

        {/* Price */}
        {preferences.filters.maxPriceLevel < 4 && (
          <FilterTag
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label={`Max ${'$'.repeat(preferences.filters.maxPriceLevel + 1)}`}
            color="emerald"
          />
        )}

        {/* Open Now */}
        {preferences.filters.openNowOnly && (
          <FilterTag
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Open now only"
            color="green"
          />
        )}

        {/* Family Friendly */}
        {preferences.filters.familyFriendly && (
          <FilterTag
            icon={<span className="text-sm">👨‍👩‍👧</span>}
            label="Family-friendly"
            color="pink"
          />
        )}

        {/* Accessible */}
        {preferences.filters.accessibilityRequired && (
          <FilterTag
            icon={<span className="text-sm">♿</span>}
            label="Wheelchair accessible"
            color="indigo"
          />
        )}
      </div>

      {/* Filter Impact Breakdown */}
      {stats.filtered > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs font-semibold opacity-60 mb-2">FILTERED OUT:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {stats.reasons.blacklisted && (
              <div className="opacity-70">
                <span className="font-semibold">{stats.reasons.blacklisted}</span> blacklisted
              </div>
            )}
            {stats.reasons.rating_too_low && (
              <div className="opacity-70">
                <span className="font-semibold">{stats.reasons.rating_too_low}</span> low rating
              </div>
            )}
            {stats.reasons.too_expensive && (
              <div className="opacity-70">
                <span className="font-semibold">{stats.reasons.too_expensive}</span> too expensive
              </div>
            )}
            {stats.reasons.too_far && (
              <div className="opacity-70">
                <span className="font-semibold">{stats.reasons.too_far}</span> too far
              </div>
            )}
            {stats.reasons.closed && (
              <div className="opacity-70">
                <span className="font-semibold">{stats.reasons.closed}</span> closed
              </div>
            )}
            {stats.reasons.not_accessible && (
              <div className="opacity-70">
                <span className="font-semibold">{stats.reasons.not_accessible}</span> not accessible
              </div>
            )}
            {stats.reasons.not_family_friendly && (
              <div className="opacity-70">
                <span className="font-semibold">{stats.reasons.not_family_friendly}</span> adult venues
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for filter tags
const FilterTag: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
}> = ({ icon, label, color }) => {
  const colorClasses = {
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
        border backdrop-blur-sm
        ${colorClasses[color as keyof typeof colorClasses] || colorClasses.purple}
      `}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}