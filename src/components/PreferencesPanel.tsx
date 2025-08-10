// src/components/PreferencesPanel.tsx
'use client';

import React, { useState } from 'react';
import { useUserPreferences } from '@/context/UserPreferencesContext';
import { getAllMappedPlaceTypes } from '@/lib/activityMapper';
import {
  Settings, Sliders, MapPin, Star, DollarSign, Sparkles,
  Heart, Ban, Zap, X, ChevronRight, Download, Upload,
  RotateCcw, Check, AlertCircle, Sun, Moon, Coffee,
  Users, UserMinus, ShoppingBag, Music, Dumbbell, Book,
  Utensils, TreePine, Gamepad2, Palette, Car, Home,
  Filter, Clock, Accessibility, Baby, Globe, Eye, EyeOff
} from 'lucide-react';

interface PreferencesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkTheme?: boolean;
}

// Activity mood configurations
const MOOD_CONFIGS = [
  { id: 'adventure', label: 'Adventure', icon: TreePine, color: 'green' },
  { id: 'relaxation', label: 'Relaxation', icon: Coffee, color: 'blue' },
  { id: 'social', label: 'Social', icon: Users, color: 'purple' },
  { id: 'solo', label: 'Solo', icon: UserMinus, color: 'gray' },
  { id: 'family', label: 'Family', icon: Baby, color: 'pink' },
  { id: 'foodie', label: 'Foodie', icon: Utensils, color: 'orange' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'indigo' },
  { id: 'culture', label: 'Culture', icon: Palette, color: 'yellow' },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell, color: 'red' },
  { id: 'nightlife', label: 'Nightlife', icon: Moon, color: 'purple' },
];

// Common place types for quick selection
const COMMON_PLACE_TYPES = [
  { type: 'restaurant', label: 'Restaurants', icon: Utensils },
  { type: 'cafe', label: 'Cafes', icon: Coffee },
  { type: 'bar', label: 'Bars', icon: Music },
  { type: 'park', label: 'Parks', icon: TreePine },
  { type: 'museum', label: 'Museums', icon: Palette },
  { type: 'gym', label: 'Gyms', icon: Dumbbell },
  { type: 'shopping_mall', label: 'Shopping', icon: ShoppingBag },
  { type: 'movie_theater', label: 'Cinema', icon: Gamepad2 },
  { type: 'library', label: 'Libraries', icon: Book },
];

// Price level labels
const PRICE_LEVELS = [
  { value: 0, label: 'Free', symbol: 'Free' },
  { value: 1, label: 'Cheap', symbol: '$' },
  { value: 2, label: 'Moderate', symbol: '$$' },
  { value: 3, label: 'Expensive', symbol: '$$$' },
  { value: 4, label: 'Very Expensive', symbol: '$$$$' },
];

export default function PreferencesPanel({ isOpen, onClose, isDarkTheme = false }: PreferencesPanelProps) {
  const {
    preferences,
    updateScoringWeight,
    toggleFavoriteType,
    toggleBlacklistType,
    setActiveMood,
    updateFilter,
    updateDisplayPreference,
    resetPreferences,
    exportPreferences,
    importPreferences,
  } = useUserPreferences();

  const [activeTab, setActiveTab] = useState<'scoring' | 'activities' | 'filters' | 'display'>('scoring');
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [importExportModal, setImportExportModal] = useState<'import' | 'export' | null>(null);
  const [importText, setImportText] = useState('');

  const allPlaceTypes = getAllMappedPlaceTypes();

  // Handle import
  const handleImport = () => {
    const success = importPreferences(importText);
    if (success) {
      setImportExportModal(null);
      setImportText('');
    }
  };

  // Handle export
  const handleExport = () => {
    const data = exportPreferences();
    navigator.clipboard.writeText(data);
    setImportExportModal(null);
  };

  if (!isOpen) return null;

  const themeClasses = isDarkTheme
    ? 'bg-gray-900 text-white'
    : 'bg-white text-gray-900';

  const borderClasses = isDarkTheme
    ? 'border-gray-700'
    : 'border-gray-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative w-full max-w-4xl max-h-[90vh] ${themeClasses} rounded-2xl shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${borderClasses}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Preferences</h2>
              <p className="text-sm opacity-60">Customize your activity recommendations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${borderClasses}`}>
          {[
            { id: 'scoring', label: 'Scoring', icon: Sliders },
            { id: 'activities', label: 'Activities', icon: Heart },
            { id: 'filters', label: 'Filters', icon: Filter },
            { id: 'display', label: 'Display', icon: Eye },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b-2 border-purple-500'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {/* Scoring Weights Tab */}
          {activeTab === 'scoring' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Personalized Scoring Weights</h3>
                <p className="text-sm opacity-60 mb-6">
                  Adjust how important each factor is when ranking activities
                </p>
              </div>

              {[
                { key: 'weatherImportance', label: 'Weather Match', icon: Sun, color: 'blue' },
                { key: 'distanceImportance', label: 'Distance', icon: MapPin, color: 'green' },
                { key: 'ratingsImportance', label: 'Ratings & Reviews', icon: Star, color: 'yellow' },
                { key: 'priceImportance', label: 'Price', icon: DollarSign, color: 'emerald' },
                { key: 'noveltyImportance', label: 'Uniqueness', icon: Sparkles, color: 'purple' },
              ].map((weight) => {
                const Icon = weight.icon;
                const value = preferences.scoringWeights[weight.key as keyof typeof preferences.scoringWeights];
                
                return (
                  <div key={weight.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-${weight.color}-500/20`}>
                          <Icon className={`w-4 h-4 text-${weight.color}-500`} />
                        </div>
                        <span className="font-medium">{weight.label}</span>
                      </div>
                      <span className="text-sm font-bold">{value}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={value}
                      onChange={(e) => updateScoringWeight(
                        weight.key as keyof typeof preferences.scoringWeights,
                        parseInt(e.target.value)
                      )}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgb(147 51 234) 0%, rgb(147 51 234) ${value}%, rgb(229 231 235) ${value}%, rgb(229 231 235) 100%)`
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === 'activities' && (
            <div className="space-y-6">
              {/* Activity Moods */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Activity Mood</h3>
                <p className="text-sm opacity-60 mb-4">
                  Quick presets for different occasions
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {MOOD_CONFIGS.map((mood) => {
                    const Icon = mood.icon;
                    const isActive = preferences.activityTypes.activeMood === mood.id;
                    
                    return (
                      <button
                        key={mood.id}
                        onClick={() => setActiveMood(isActive ? null : mood.id)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          isActive
                            ? 'border-purple-500 bg-purple-500/10'
                            : `border-gray-300 dark:border-gray-700 hover:border-purple-400`
                        }`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-1 ${
                          isActive ? 'text-purple-500' : 'opacity-60'
                        }`} />
                        <span className="text-xs font-medium">{mood.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Favorite Categories */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Favorite Categories</h3>
                <p className="text-sm opacity-60 mb-4">
                  Always show these types first
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {COMMON_PLACE_TYPES.map((item) => {
                    const Icon = item.icon;
                    const isFavorite = preferences.activityTypes.favorites.includes(item.type);
                    
                    return (
                      <button
                        key={item.type}
                        onClick={() => toggleFavoriteType(item.type)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          isFavorite
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-gray-300 dark:border-gray-700 hover:border-green-400'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${
                          isFavorite ? 'text-green-500' : 'opacity-60'
                        }`} />
                        <span className="text-xs">{item.label}</span>
                        {isFavorite && (
                          <Heart className="w-3 h-3 text-green-500 mx-auto mt-1 fill-current" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Blacklisted Categories */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Hidden Categories</h3>
                <p className="text-sm opacity-60 mb-4">
                  Never show these activity types
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {COMMON_PLACE_TYPES.map((item) => {
                    const Icon = item.icon;
                    const isBlacklisted = preferences.activityTypes.blacklist.includes(item.type);
                    
                    return (
                      <button
                        key={item.type}
                        onClick={() => toggleBlacklistType(item.type)}
                        className={`p-3 rounded-xl border-2 transition-all ${
                          isBlacklisted
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-gray-300 dark:border-gray-700 hover:border-red-400'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mx-auto mb-1 ${
                          isBlacklisted ? 'text-red-500 line-through' : 'opacity-60'
                        }`} />
                        <span className={`text-xs ${isBlacklisted ? 'line-through' : ''}`}>
                          {item.label}
                        </span>
                        {isBlacklisted && (
                          <Ban className="w-3 h-3 text-red-500 mx-auto mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Show all types button */}
                <button
                  onClick={() => setShowAllTypes(!showAllTypes)}
                  className="mt-4 text-sm text-purple-500 hover:text-purple-600 flex items-center gap-1"
                >
                  {showAllTypes ? 'Show less' : 'Show all place types'}
                  <ChevronRight className={`w-4 h-4 transition-transform ${
                    showAllTypes ? 'rotate-90' : ''
                  }`} />
                </button>
                
                {/* Extended place types list */}
                {showAllTypes && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {allPlaceTypes.map((type) => {
                      const isFavorite = preferences.activityTypes.favorites.includes(type);
                      const isBlacklisted = preferences.activityTypes.blacklist.includes(type);
                      
                      return (
                        <div
                          key={type}
                          className={`flex items-center justify-between p-2 rounded-lg border ${borderClasses}`}
                        >
                          <span className={`text-sm ${
                            isBlacklisted ? 'line-through opacity-50' : ''
                          }`}>
                            {type.replace(/_/g, ' ')}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => toggleFavoriteType(type)}
                              className={`p-1 rounded ${
                                isFavorite ? 'text-green-500' : 'text-gray-400 hover:text-green-500'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={() => toggleBlacklistType(type)}
                              className={`p-1 rounded ${
                                isBlacklisted ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                              }`}
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Filters Tab */}
          {activeTab === 'filters' && (
            <div className="space-y-6">
              {/* Search Radius */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Search Radius</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm opacity-60">Maximum distance</span>
                  <span className="font-bold">{preferences.filters.maxRadius} km</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={preferences.filters.maxRadius}
                  onChange={(e) => updateFilter('maxRadius', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs opacity-60 mt-1">
                  <span>1 km</span>
                  <span>20 km</span>
                </div>
              </div>

              {/* Budget Filter */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Budget</h3>
                <p className="text-sm opacity-60 mb-4">Maximum price level</p>
                <div className="grid grid-cols-5 gap-2">
                  {PRICE_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => updateFilter('maxPriceLevel', level.value)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        preferences.filters.maxPriceLevel >= level.value
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-300 dark:border-gray-700 opacity-50'
                      }`}
                    >
                      <div className="text-center">
                        <div className="font-bold text-sm">{level.symbol}</div>
                        <div className="text-xs opacity-60 mt-1">{level.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Minimum Rating */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Minimum Rating</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm opacity-60">Only show places rated</span>
                  <span className="font-bold">
                    {preferences.filters.minRating > 0 ? `${preferences.filters.minRating}+ stars` : 'Any rating'}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={preferences.filters.minRating}
                  onChange={(e) => updateFilter('minRating', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between mt-2">
                  {[0, 1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => updateFilter('minRating', rating)}
                      className={`flex items-center gap-1 px-2 py-1 rounded ${
                        preferences.filters.minRating === rating
                          ? 'bg-yellow-500/20 text-yellow-600'
                          : ''
                      }`}
                    >
                      <Star className="w-3 h-3" />
                      <span className="text-xs">{rating}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle Filters */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold mb-2">Additional Filters</h3>
                
                {[
                  { key: 'openNowOnly', label: 'Only show open places', icon: Clock },
                  { key: 'accessibilityRequired', label: 'Wheelchair accessible only', icon: Accessibility },
                  { key: 'familyFriendly', label: 'Family-friendly only', icon: Baby },
                ].map((filter) => {
                  const Icon = filter.icon;
                  const isEnabled = preferences.filters[filter.key as keyof typeof preferences.filters];
                  
                  return (
                    <button
                      key={filter.key}
                      onClick={() => updateFilter(filter.key as any, !isEnabled)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        isEnabled
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${isEnabled ? 'text-purple-500' : 'opacity-60'}`} />
                        <span className="font-medium">{filter.label}</span>
                      </div>
                      <div className={`w-12 h-6 rounded-full transition-colors ${
                        isEnabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-700'
                      }`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        } mt-0.5`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4">Display Settings</h3>
              
              {[
                { key: 'showScoreBreakdown', label: 'Show detailed score breakdown', icon: Sliders },
                { key: 'compactView', label: 'Compact activity cards', icon: Eye },
                { key: 'autoRefresh', label: 'Auto-refresh on location change', icon: RotateCcw },
                { key: 'metricUnits', label: 'Use metric units (km instead of miles)', icon: Globe },
              ].map((setting) => {
                const Icon = setting.icon;
                const isEnabled = preferences.displayPreferences[
                  setting.key as keyof typeof preferences.displayPreferences
                ];
                
                return (
                  <button
                    key={setting.key}
                    onClick={() => updateDisplayPreference(setting.key as any, !isEnabled)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      isEnabled
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-300 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isEnabled ? 'text-purple-500' : 'opacity-60'}`} />
                      <span className="font-medium">{setting.label}</span>
                    </div>
                    <div className={`w-12 h-6 rounded-full transition-colors ${
                      isEnabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-700'
                    }`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      } mt-0.5`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`flex items-center justify-between p-6 border-t ${borderClasses}`}>
          <div className="flex gap-2">
            <button
              onClick={() => setImportExportModal('export')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export</span>
            </button>
            <button
              onClick={() => setImportExportModal('import')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="text-sm font-medium">Import</span>
            </button>
          </div>
          
          <button
            onClick={resetPreferences}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium">Reset All</span>
          </button>
        </div>
      </div>

      {/* Import/Export Modal */}
      {importExportModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60"
            onClick={() => setImportExportModal(null)}
          />
          <div className={`relative w-full max-w-md ${themeClasses} rounded-xl p-6 shadow-2xl`}>
            <h3 className="text-lg font-semibold mb-4">
              {importExportModal === 'import' ? 'Import Preferences' : 'Export Preferences'}
            </h3>
            
            {importExportModal === 'import' ? (
              <>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your preferences JSON here..."
                  className={`w-full h-40 p-3 rounded-lg border ${borderClasses} bg-gray-50 dark:bg-gray-800`}
                />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setImportExportModal(null)}
                    className="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    className="flex-1 px-4 py-2 rounded-lg bg-purple-500 text-white"
                  >
                    Import
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm opacity-60 mb-4">
                  Your preferences have been copied to clipboard!
                </p>
                <button
                  onClick={handleExport}
                  className="w-full px-4 py-2 rounded-lg bg-purple-500 text-white"
                >
                  Copy to Clipboard
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}