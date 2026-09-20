// src/lib/utils.js - Utility functions
import { format, formatDistanceToNow } from 'date-fns';

export function formatDate(date) {
  if (!date) return 'N/A';
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
}

export function formatRelativeTime(date) {
  if (!date) return 'N/A';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getStatusColor(status) {
  const colors = {
    active: 'bg-blue-100 text-blue-800',
    matched: 'bg-purple-100 text-purple-800',
    collected: 'bg-green-100 text-green-800',
    deleted: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
    verified: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getLockerStateColor(state) {
  const colors = {
    AVAILABLE: 'bg-green-100 text-green-800',
    RESERVED: 'bg-yellow-100 text-yellow-800',
    ITEM_DEPOSITED: 'bg-blue-100 text-blue-800',
    READY_FOR_COLLECTION: 'bg-purple-100 text-purple-800',
    OPEN: 'bg-orange-100 text-orange-800',
    COLLECTED: 'bg-green-100 text-green-800',
    OFFLINE: 'bg-gray-100 text-gray-800',
    ERROR: 'bg-red-100 text-red-800',
  };
  return colors[state] || 'bg-gray-100 text-gray-800';
}

export function getCategoryIcon(category) {
  const icons = {
    electronics: '📱',
    bags: '🎒',
    documents: '📄',
    keys: '🔑',
    clothing: '👕',
    jewelry: '💍',
    sports: '⚽',
    books: '📚',
    other: '📦',
  };
  return icons[category] || '📦';
}

export function truncate(text, length = 100) {
  if (!text) return '';
  return text.length > length ? text.slice(0, length) + '...' : text;
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const CATEGORIES = [
  { value: 'electronics', label: 'Electronics', icon: '📱' },
  { value: 'bags', label: 'Bags & Backpacks', icon: '🎒' },
  { value: 'documents', label: 'Documents & IDs', icon: '📄' },
  { value: 'keys', label: 'Keys', icon: '🔑' },
  { value: 'clothing', label: 'Clothing', icon: '👕' },
  { value: 'jewelry', label: 'Jewelry & Accessories', icon: '💍' },
  { value: 'sports', label: 'Sports Equipment', icon: '⚽' },
  { value: 'books', label: 'Books & Stationery', icon: '📚' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export const DEMO_USERS = [
  { id: 'demo-user-1', name: 'Alice Johnson (User)', role: 'user' },
  { id: 'demo-user-2', name: 'Bob Smith (User)', role: 'user' },
  { id: 'demo-admin-1', name: 'Admin User', role: 'institution_admin' },
  { id: 'demo-police-1', name: 'Officer Singh (Police)', role: 'police' },
  { id: 'demo-super-1', name: 'Super Admin', role: 'super_admin' },
];
